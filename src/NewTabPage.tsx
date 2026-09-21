import { useEffect, useState } from "react"

import { BoardDnd } from "~/components/BoardDnd"
import { BoardList } from "~/components/BoardList"
import { DeleteDialog } from "~/components/DeleteDialog"
import { ItemDialog } from "~/components/ItemDialog"
import { SettingsDialog } from "~/components/SettingsDialog"
import { ErrorView } from "~/components/StatusViews"
import { WidgetIcon } from "~/components/WidgetIcon"
import { useDayboardState } from "~/hooks/useDayboardState"
import { useNow } from "~/hooks/useNow"
import { getGreeting, getHeaderDate } from "~/lib/greeting"
import { parseDayboardState, serializeDayboardState } from "~/lib/storage"
import {
  archiveWidget,
  createWidget,
  moveActiveWidget,
  reorderWidgets,
  restoreWidget
} from "~/lib/widgets"
import type { Widget, WidgetKind } from "~/lib/types"

interface EditorState {
  mode: "add" | "edit"
  item: Widget
}

// Leading icons for the card context menu.
// The move icons point in reading order (back/forward), matching the "back/next" labels.
const MENU_ICON_PATHS = {
  moveBack: "M19 12H5m6-6-6 6 6 6",
  moveNext: "M5 12h14m-6-6 6 6-6 6",
  edit: "M4.5 19.5h4L19 9a2.12 2.12 0 0 0-3-3L5.5 16.5l-1 3ZM13.5 5.5l3 3",
  archive:
    "M4.5 5h15a.5.5 0 0 1 .5.5V8H4V5.5a.5.5 0 0 1 .5-.5ZM5 8v10.5a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V8M10 11.5h4",
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

  const saveItem = (item: Widget) => {
    const nextWidgets =
      editorState?.mode === "edit"
        ? state.widgets.map((current) => (current.id === item.id ? item : current))
        : [...state.widgets, item]

    void setWidgets(nextWidgets)
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
    closeOpenMenus()
    void setWidgets(state.widgets.filter((current) => current.id !== item.id))
    setItemPendingDelete(null)
  }

  const archiveItem = (item: Widget) => {
    closeOpenMenus()
    void setWidgets(archiveWidget(state.widgets, item.id))
  }

  const restoreItem = (item: Widget) => {
    closeOpenMenus()
    void setWidgets(restoreWidget(state.widgets, item.id))
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

  const importBoard = async (file: File) => {
    setImportError(null)
    try {
      const imported = parseDayboardState(await file.text())
      await replaceState(imported)
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
          onArchive={(id) => void setWidgets(archiveWidget(state.widgets, id))}
          onReorder={reorderList}
          onRestore={(id, beforeId) =>
            void setWidgets(restoreWidget(state.widgets, id, beforeId))
          }>
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
                        onClick={() => archiveItem(item)}
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
                              onClick={() => restoreItem(item)}
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
        isOpen={Boolean(editorState)}
        item={editorState?.item ?? null}
        mode={editorState?.mode ?? "add"}
        onClose={() => setEditorState(null)}
        onSave={saveItem}
      />
      <DeleteDialog
        isOpen={Boolean(itemPendingDelete)}
        item={itemPendingDelete}
        onCancel={() => setItemPendingDelete(null)}
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
      {saveError ? (
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
    </>
  )
}
