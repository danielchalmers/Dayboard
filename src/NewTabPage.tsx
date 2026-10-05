import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from "react"

import { ArchiveNotice } from "~/components/ArchiveNotice"
import { ARCHIVE_ICON_PATH, BoardDnd } from "~/components/BoardDnd"
import { BoardList } from "~/components/BoardList"
import { DeleteDialog } from "~/components/DeleteDialog"
import { ItemDialog } from "~/components/ItemDialog"
import { SettingsDialog } from "~/components/SettingsDialog"
import { ErrorView } from "~/components/StatusViews"
import { WidgetIcon } from "~/components/WidgetIcon"
import { useDayboardState } from "~/hooks/useDayboardState"
import { useNow } from "~/hooks/useNow"
import { getGreeting, getHeaderDate } from "~/lib/greeting"
import {
  isSameData,
  parseDayboardState,
  serializeDayboardState
} from "~/lib/storage"
import {
  applyDialogEdit,
  archiveWidget,
  createWidget,
  moveActiveWidget,
  neighborsOf,
  reorderWidgets,
  restoreWidget,
  undoArchiveWidget
} from "~/lib/widgets"
import type { DayboardState, Widget, WidgetKind } from "~/lib/types"

interface EditorState {
  mode: "add" | "edit"
  item: Widget
  /** Why the last save from this dialog was refused. */
  error?: string
}

interface ImportUndo {
  /** The board the import replaced. */
  previous: DayboardState
  /** The board as it was imported. */
  imported: DayboardState
}

// The last archive, kept just long enough to undo: the card, and the board cards either side of it when it left.
interface UndoableArchive {
  id: string
  previousId?: string
  nextId?: string
}

// Leading icons for the card context menu.
// The move icons point in reading order (back/forward), matching the "back/next" labels.
const MENU_ICON_PATHS = {
  moveBack: "M19 12H5m6-6-6 6 6 6",
  moveNext: "M5 12h14m-6-6 6 6-6 6",
  edit: "M4.5 19.5h4L19 9a2.12 2.12 0 0 0-3-3L5.5 16.5l-1 3ZM13.5 5.5l3 3",
  archive: ARCHIVE_ICON_PATH,
  restore: "M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5",
  del: "M4.5 7h15M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7m-8.2 0 .9 11.6a1.5 1.5 0 0 0 1.5 1.4h5.6a1.5 1.5 0 0 0 1.5-1.4L19 7M10 11v5M14 11v5"
} as const

const MenuIcon = ({ name }: { name: keyof typeof MENU_ICON_PATHS }) => (
  <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17">
    <path
      d={MENU_ICON_PATHS[name]}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
)

// A line apiece so the menu says what each kind is, rather than leaving "Add quote" and "Add note" to be told apart by guesswork.
// Plain descriptions of what the card shows: this is a menu, not a place to sell the widget.
const ADD_MENU_KINDS: { kind: WidgetKind; label: string; hint: string }[] = [
  { kind: "clock", label: "Clock", hint: "Current time in a time zone" },
  { kind: "countdown", label: "Countdown", hint: "Time left until a date" },
  { kind: "note", label: "Note", hint: "Editable text on the card" },
  { kind: "quote", label: "Quote", hint: "A line from your list" },
  { kind: "stopwatch", label: "Stopwatch", hint: "Time counted up from zero" },
  { kind: "timer", label: "Timer", hint: "Time counted down to zero" },
  { kind: "habit", label: "Habit", hint: "Daily marks over a week" },
  { kind: "todo", label: "Todo", hint: "Four tasks you check off" }
]

// The new tab page doubles as the extension's options page.
// When the browser opens it as options it appends `?view=settings`, so the overlay shows itself.
const wantsSettingsView = (): boolean => {
  if (typeof window === "undefined") {
    return false
  }

  return (
    new URLSearchParams(window.location.search).get("view") === "settings" ||
    window.location.hash === "#settings"
  )
}

// The greeting turns over with the hour and the date at midnight, so the header keeps its own minute subscription: nothing else on the page has a reason to render when the clock moves.
const PageGreeting = ({ name }: { name: string }) => {
  const now = useNow("minute")

  return (
    <div>
      <h1 className="page-header__greeting">{getGreeting(now, name)}</h1>
      <p className="page-header__date">{getHeaderDate(now)}</p>
    </div>
  )
}

const closeOpenMenus = (eventPath?: EventTarget[]) => {
  document
    .querySelectorAll<HTMLDetailsElement>(".add-menu[open], .card-menu[open]")
    .forEach((menu) => {
      if (!eventPath || !eventPath.includes(menu)) {
        menu.removeAttribute("open")
      }
    })
}

// Focus is looked after only when an action came from the keyboard or assistive tech.
// A pointer user has no place on the board to keep, and a card left focused without a ring would take their next Space as the start of a drag.
// A click made by a key or a screen reader carries no click count, and a focus the keyboard placed matches :focus-visible.
const isKeyboardAction = (event?: { detail: number }) =>
  event?.detail === 0 ||
  Boolean(document.activeElement?.matches(":focus-visible"))

export function NewTabPage() {
  const {
    state,
    isLoading,
    error,
    setWidgets,
    setSettings,
    updateWidget,
    replaceState,
    saveError,
    dismissSaveError
  } = useDayboardState()
  const [editorState, setEditorState] = useState<EditorState | null>(null)
  const [itemPendingDelete, setItemPendingDelete] = useState<Widget | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(wantsSettingsView)
  const [showArchived, setShowArchived] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importUndo, setImportUndo] = useState<ImportUndo | null>(null)
  const [undoableArchive, setUndoableArchive] = useState<UndoableArchive | null>(null)
  const archiveToggleRef = useRef<HTMLButtonElement>(null)

  // Archiving, restoring, or deleting a card unmounts whatever had focus (the menu item, the dialog's button, the card itself), which drops the keyboard on the page body and sends the next Tab to the far end of the board.
  // So a keyboard action names the card to land on instead, the way the todo list hands focus to the row that takes a removed task's place.
  // No card to land on (the board just emptied) falls back to the archive toggle, the next stop after the board.
  const focusLanding = useRef<{ id?: string } | null>(null)
  const expireUndo = useCallback(() => setUndoableArchive(null), [])

  // Undo only stands for an archive that is still in place.
  // Once the card is back on the board (restored by hand, or from another tab) or a failed save has rolled the archive back, there is nothing left to undo, and the notice goes rather than waiting to come back later for an archive made somewhere else.
  const undoableItem = undoableArchive
    ? state?.widgets.find(
        (widget) => widget.id === undoableArchive.id && widget.archived
      )
    : undefined

  useEffect(() => {
    if (undoableArchive && !undoableItem) {
      setUndoableArchive(null)
    }
  }, [undoableArchive, undoableItem])

  useEffect(() => {
    const landing = focusLanding.current

    if (!landing) {
      return
    }

    focusLanding.current = null

    // Only a focus that fell to the page is picked back up; one that is somewhere on purpose stays put.
    if (document.activeElement && document.activeElement !== document.body) {
      return
    }

    const card = Array.from(
      document.querySelectorAll<HTMLElement>("[data-widget-id]")
    ).find((element) => element.dataset.widgetId === landing.id)

    ;(card ?? archiveToggleRef.current)?.focus()
  })

  useEffect(() => {
    const closeMenusAfterOutsidePointerDown = (event: PointerEvent) =>
      closeOpenMenus(event.composedPath())

    window.addEventListener("pointerdown", closeMenusAfterOutsidePointerDown)
    return () =>
      window.removeEventListener("pointerdown", closeMenusAfterOutsidePointerDown)
  }, [])

  // Only the very first run (no cached board yet) waits on storage; a spinner would just flash, so stay blank on the page background until it resolves.
  if (isLoading) {
    return null
  }

  if (error || !state) {
    return <ErrorView message={error || "Unable to load Dayboard"} />
  }

  // An edit lands on the card as it is now (see applyDialogEdit), and a card deleted elsewhere while its dialog sat open stays deleted.
  // The dialog waits for the write before it closes: when storage refuses it, the dialog stays open on everything typed into it and says why, instead of closing on a draft that is about to be rolled back.
  // A write that lands late closes only the dialog its Save was pressed in, never one opened since, even for the same card.
  const saveItem = async (item: Widget) => {
    const opened = editorState?.item
    const latest = state.widgets.find((current) => current.id === item.id)
    const nextWidgets = latest
      ? state.widgets.map((current) =>
          current === latest ? applyDialogEdit(latest, item) : current
        )
      : editorState?.mode === "add"
        ? [...state.widgets, item]
        : null
    const refused = nextWidgets ? await setWidgets(nextWidgets) : null

    setEditorState((current) =>
      !current || current.item !== opened
        ? current
        : refused
          ? { ...current, error: refused }
          : null
    )
  }

  // The dialog already said why its own save was refused, so closing it on that draft is the user letting the change go.
  const closeEditor = () => {
    if (editorState?.error) {
      dismissSaveError()
    }

    setEditorState(null)
  }

  const reorderItem = (id: string, direction: -1 | 1) => {
    closeOpenMenus()
    void setWidgets(moveActiveWidget(state.widgets, id, direction))
  }

  const reorderList = (activeId: string, overId: string) => {
    void setWidgets(reorderWidgets(state.widgets, activeId, overId))
  }

  const deleteItem = (item: Widget) => {
    if (isKeyboardAction()) {
      const { previous, next } = neighborsOf(state.widgets, item.id)
      focusLanding.current = { id: (next ?? previous)?.id }
    }

    closeOpenMenus()
    void setWidgets(state.widgets.filter((current) => current.id !== item.id))
    setItemPendingDelete(null)
  }

  // Every archive, from the menu or a drop, goes through here, so each one can be undone back into the slot it left.
  const archive = (id: string, fromKeyboard: boolean) => {
    const { previous, next } = neighborsOf(state.widgets, id)

    if (fromKeyboard) {
      focusLanding.current = { id: (next ?? previous)?.id }
    }

    setUndoableArchive({ id, previousId: previous?.id, nextId: next?.id })
    void setWidgets(archiveWidget(state.widgets, id))
  }

  const restore = (
    id: string,
    beforeId: string | undefined,
    fromKeyboard: boolean
  ) => {
    if (fromKeyboard) {
      focusLanding.current = { id }
    }

    void setWidgets(restoreWidget(state.widgets, id, beforeId))
  }

  const archiveItem = (item: Widget, event: ReactMouseEvent) => {
    const fromKeyboard = isKeyboardAction(event)
    closeOpenMenus()
    archive(item.id, fromKeyboard)
  }

  const restoreItem = (item: Widget, event: ReactMouseEvent) => {
    const fromKeyboard = isKeyboardAction(event)
    closeOpenMenus()
    restore(item.id, undefined, fromKeyboard)
  }

  const undoArchive = (
    { id, ...neighbors }: UndoableArchive,
    fromKeyboard: boolean
  ) => {
    if (fromKeyboard) {
      focusLanding.current = { id }
    }

    setUndoableArchive(null)
    void setWidgets(undoArchiveWidget(state.widgets, id, neighbors))
  }

  const addItem = (kind: Widget["kind"]) => {
    closeOpenMenus()
    setEditorState({
      mode: "add",
      item: createWidget(kind)
    })
  }

  const openSettings = () => {
    closeOpenMenus()
    setImportError(null)
    setIsSettingsOpen(true)
  }

  const exportBoard = () => {
    const blob = new Blob([serializeDayboardState(state)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "dayboard.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  // An import replaces the whole board, the name included, so the board it replaced is kept for an Undo in the notice that follows rather than a confirmation asked up front.
  const importBoard = async (file: File) => {
    setImportError(null)
    try {
      const imported = parseDayboardState(await file.text())
      const previous = state

      if ((await replaceState(imported)) === null) {
        // An archive still on offer was taken off the board the import replaced, so the import's own Undo takes the notice.
        setUndoableArchive(null)
        setImportUndo({ previous, imported })
      }

      setIsSettingsOpen(false)
    } catch (cause) {
      setImportError(
        cause instanceof Error ? cause.message : "Couldn’t import that file."
      )
    }
  }

  const closeSettings = () => {
    setIsSettingsOpen(false)
    setImportError(null)
  }

  // The undo is only offered while the board is still exactly what was imported: once anything has changed since, putting the old board back would quietly throw that change away too.
  // The board is compared by what it holds, since a late echo of an earlier write can swap the board object out and back with nothing changed.
  const canUndoImport =
    importUndo !== null && isSameData(state, importUndo.imported)

  const undoImport = async () => {
    if (importUndo && (await replaceState(importUndo.previous)) === null) {
      setImportUndo(null)
    }
  }

  return (
    <>
      <main className="page">
        <header className="page-header">
          <PageGreeting name={state.settings.name} />
          <div className="page-header__actions">
            <button
              aria-label="Options"
              className="icon-button"
              onClick={openSettings}
              title="Options"
              type="button">
              <svg
                aria-hidden="true"
                fill="none"
                height="24"
                viewBox="0 0 24 24"
                width="24">
                <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M19.4 12c0-.5-.05-1-.13-1.46l1.9-1.46-1.9-3.29-2.24.9a7.4 7.4 0 0 0-2.53-1.47L12.93 2h-3.8l-.57 2.72a7.4 7.4 0 0 0-2.53 1.47l-2.24-.9-1.9 3.29 1.9 1.46c-.08.47-.13.96-.13 1.46s.05 1 .13 1.46l-1.9 1.46 1.9 3.29 2.24-.9c.74.63 1.6 1.13 2.53 1.47L9.13 22h3.8l.57-2.72a7.4 7.4 0 0 0 2.53-1.47l2.24.9 1.9-3.29-1.9-1.46c.08-.47.13-.96.13-1.46Z"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                />
              </svg>
            </button>
            <details
              className="add-menu"
              onKeyDown={(event) => {
                // Native <details> ignores Escape; close it and refocus the toggle so the disclosure behaves like a real popup.
                if (event.key === "Escape" && event.currentTarget.open) {
                  event.currentTarget.removeAttribute("open")
                  event.currentTarget
                    .querySelector<HTMLElement>("summary")
                    ?.focus()
                }
              }}>
              <summary
                aria-label="Add widget"
                className="icon-button"
                role="button"
                title="Add widget">
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="24"
                  viewBox="0 0 24 24"
                  width="24">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </summary>
              <div className="add-menu__panel">
                {ADD_MENU_KINDS.map(({ kind, label, hint }) => (
                  <button
                    // The subtitle would otherwise land in the accessible name and bury the action, so name the button and offer the line as its description.
                    aria-describedby={`add-${kind}-hint`}
                    aria-label={`Add ${label.toLowerCase()}`}
                    className="menu-button menu-button--described"
                    key={kind}
                    onClick={() => addItem(kind)}
                    type="button">
                    <span
                      aria-hidden="true"
                      className="menu-chip">
                      <WidgetIcon kind={kind} size={18} />
                    </span>
                    <span className="menu-button__text">
                      <span className="menu-button__label">
                        Add {label.toLowerCase()}
                      </span>
                      <span className="menu-button__hint" id={`add-${kind}-hint`}>
                        {hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </header>
        {/* One drag context spans the board and the archived list, so an archived card can be dragged straight into the exact board slot it should take, while an active card heads for the archive drop zone.
            The lists render from BoardDnd's view of the widgets, which mid-drag previews the restore with the dragged card already sitting in its board slot. */}
        <BoardDnd
          widgets={state.widgets}
          onArchive={archive}
          onReorder={reorderList}
          onRestore={restore}>
          {(displayWidgets) => {
            const activeWidgets = displayWidgets.filter(
              (widget) => !widget.archived
            )
            const archivedWidgets = displayWidgets.filter(
              (widget) => widget.archived
            )

            return (
              <>
                <BoardList
                  hasArchived={archivedWidgets.length > 0}
                  items={activeWidgets}
                  restoreTarget
                  onWidgetChange={updateWidget}
                  renderItemActions={(item, index) => (
                    <>
                      {/* The board reads left-to-right, top-to-bottom, so the menu moves in reading order; "up/down" would lie in a multi-column grid. */}
                      <button
                        aria-label={`Move ${item.title} back`}
                        className="menu-button"
                        disabled={index === 0}
                        onClick={() => reorderItem(item.id, -1)}
                        role="menuitem"
                        type="button">
                        <MenuIcon name="moveBack" />
                        Move back
                      </button>
                      <button
                        aria-label={`Move ${item.title} next`}
                        className="menu-button"
                        disabled={index === activeWidgets.length - 1}
                        onClick={() => reorderItem(item.id, 1)}
                        role="menuitem"
                        type="button">
                        <MenuIcon name="moveNext" />
                        Move next
                      </button>
                      <div aria-hidden="true" className="menu-separator" />
                      <button
                        aria-label={`Edit ${item.title}`}
                        className="menu-button"
                        onClick={() => {
                          closeOpenMenus()
                          setEditorState({ mode: "edit", item })
                        }}
                        role="menuitem"
                        type="button">
                        <MenuIcon name="edit" />
                        Edit
                      </button>
                      <button
                        aria-label={`Archive ${item.title}`}
                        className="menu-button"
                        onClick={(event) => archiveItem(item, event)}
                        role="menuitem"
                        type="button">
                        <MenuIcon name="archive" />
                        Archive
                      </button>
                      <div aria-hidden="true" className="menu-separator" />
                      <button
                        aria-label={`Delete ${item.title}`}
                        className="menu-button menu-button--danger"
                        onClick={() => {
                          closeOpenMenus()
                          setItemPendingDelete(item)
                        }}
                        role="menuitem"
                        type="button">
                        <MenuIcon name="del" />
                        Delete
                      </button>
                    </>
                  )}
                />
                {archivedWidgets.length > 0 ? (
                  <section className="archive-section">
                    <button
                      aria-expanded={showArchived}
                      className="archive-toggle"
                      onClick={() => setShowArchived((shown) => !shown)}
                      ref={archiveToggleRef}
                      type="button">
                      {showArchived ? "Hide archived" : "Show archived"}
                      {/* The chevron says this is a disclosure; flipping it is the open/closed state made visible. */}
                      <svg
                        aria-hidden="true"
                        className="archive-toggle__chevron"
                        fill="none"
                        height="14"
                        viewBox="0 0 24 24"
                        width="14">
                        <path
                          d="m6 9 6 6 6-6"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </button>
                    {showArchived ? (
                      <BoardList
                        items={archivedWidgets}
                        onWidgetChange={updateWidget}
                        renderItemActions={(item) => (
                          <>
                            <button
                              aria-label={`Restore ${item.title}`}
                              className="menu-button"
                              onClick={(event) => restoreItem(item, event)}
                              role="menuitem"
                              type="button">
                              <MenuIcon name="restore" />
                              Restore
                            </button>
                            <button
                              aria-label={`Edit ${item.title}`}
                              className="menu-button"
                              onClick={() => {
                                closeOpenMenus()
                                setEditorState({ mode: "edit", item })
                              }}
                              role="menuitem"
                              type="button">
                              <MenuIcon name="edit" />
                              Edit
                            </button>
                            <div aria-hidden="true" className="menu-separator" />
                            <button
                              aria-label={`Delete ${item.title}`}
                              className="menu-button menu-button--danger"
                              onClick={() => {
                                closeOpenMenus()
                                setItemPendingDelete(item)
                              }}
                              role="menuitem"
                              type="button">
                              <MenuIcon name="del" />
                              Delete
                            </button>
                          </>
                        )}
                      />
                    ) : null}
                  </section>
                ) : null}
              </>
            )
          }}
        </BoardDnd>
      </main>
      <ItemDialog
        error={editorState?.error}
        isOpen={Boolean(editorState)}
        item={editorState?.item ?? null}
        mode={editorState?.mode ?? "add"}
        onClose={closeEditor}
        onSave={(item) => void saveItem(item)}
      />
      <DeleteDialog
        isOpen={Boolean(itemPendingDelete)}
        item={itemPendingDelete}
        onCancel={() => {
          if (isKeyboardAction()) {
            focusLanding.current = { id: itemPendingDelete?.id }
          }

          setItemPendingDelete(null)
        }}
        onConfirm={deleteItem}
      />
      <SettingsDialog
        isOpen={isSettingsOpen}
        settings={state.settings}
        importError={importError}
        onChange={(settings) => void setSettings(settings)}
        onClose={closeSettings}
        onExport={exportBoard}
        onImport={(file) => void importBoard(file)}
      />
      {/* One place at the bottom of the page holds one notice at a time, and a refused save outranks an undo for it.
          A refused dialog save is told inside the dialog, beside the draft it kept, rather than twice. */}
      {saveError && !editorState?.error ? (
        <div className="board-notice" role="alert">
          <span className="board-notice__text">{saveError}</span>
          <button
            aria-label="Dismiss"
            className="board-notice__dismiss"
            onClick={dismissSaveError}
            type="button">
            Dismiss
          </button>
        </div>
      ) : null}
      {/* The live region stays mounted so an undo is announced as it is offered; one inserted along with its text is easily missed.
          Archiving and importing each change the board the other's Undo would act on, so only the latest of the two is ever on offer. */}
      <div role="status">
        {undoableArchive && undoableItem ? (
          // A refused save takes the spot, but the archive's few seconds keep running underneath it, so the Undo is not offered long after the fact once that notice goes.
          <div hidden={Boolean(saveError)}>
            <ArchiveNotice
              key={undoableArchive.id}
              onExpire={expireUndo}
              onUndo={(event) =>
                undoArchive(undoableArchive, isKeyboardAction(event))
              }
              title={undoableItem.title}
            />
          </div>
        ) : !saveError && canUndoImport ? (
          <div className="board-notice board-notice--quiet">
            <span className="board-notice__text">Board imported.</span>
            <span className="board-notice__actions">
              <button
                className="board-notice__action"
                onClick={() => void undoImport()}
                type="button">
                Undo
              </button>
              <button
                className="board-notice__dismiss"
                onClick={() => setImportUndo(null)}
                type="button">
                Dismiss
              </button>
            </span>
          </div>
        ) : null}
      </div>
    </>
  )
}
