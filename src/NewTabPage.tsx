import { useEffect, useState } from "react"

import { BoardList } from "~/components/BoardList"
import { DeleteDialog } from "~/components/DeleteDialog"
import { ItemDialog } from "~/components/ItemDialog"
import { SettingsDialog } from "~/components/SettingsDialog"
import { ErrorView, LoadingView } from "~/components/StatusViews"
import { useClockboardState } from "~/hooks/useClockboardState"
import { useNow } from "~/hooks/useNow"
import { getGreeting } from "~/lib/greeting"
import { parseClockboardState, serializeClockboardState } from "~/lib/storage"
import {
  archiveWidget,
  createWidget,
  moveWidget,
  reorderWidgets,
  restoreWidget
} from "~/lib/widgets"
import type { Widget } from "~/lib/types"

interface EditorState {
  mode: "add" | "edit"
  item: Widget
}

// The new tab page doubles as the extension's options page. When the browser
// opens it as options it appends `?view=settings`, so the overlay shows itself.
const wantsSettingsView = (): boolean => {
  if (typeof window === "undefined") {
    return false
  }

  return (
    new URLSearchParams(window.location.search).get("view") === "settings" ||
    window.location.hash === "#settings"
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
  const now = useNow()
  const {
    state,
    isLoading,
    error,
    setWidgets,
    setSettings,
    replaceState,
    saveError,
    dismissSaveError
  } = useClockboardState()
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

  if (isLoading) {
    return <LoadingView />
  }

  if (error || !state) {
    return <ErrorView message={error || "Unable to load Clockboard"} />
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
    void setWidgets(moveWidget(state.widgets, id, direction))
  }

  const reorderList = (activeId: string, overId: string) => {
    void setWidgets(reorderWidgets(state.widgets, activeId, overId))
  }

  const deleteItem = (item: Widget) => {
    closeOpenMenus()
    void setWidgets(state.widgets.filter((current) => current.id !== item.id))
    setItemPendingDelete(null)
  }

  // Live update from an interactive widget (e.g. typing into a note), saved in
  // place without opening the edit dialog.
  const updateWidget = (widget: Widget) => {
    void setWidgets(
      state.widgets.map((current) =>
        current.id === widget.id ? widget : current
      )
    )
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
    const blob = new Blob([serializeClockboardState(state)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "clockboard.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  const importBoard = async (file: File) => {
    setImportError(null)
    try {
      const imported = parseClockboardState(await file.text())
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

  const activeWidgets = state.widgets.filter((widget) => !widget.archived)
  const archivedWidgets = state.widgets.filter((widget) => widget.archived)

  return (
    <>
      <main className="page">
        <header className="page-header">
          <div>
            <h1>Clockboard</h1>
            <p className="page-header__greeting">
              {getGreeting(now, state.settings.name)}
            </p>
          </div>
          <div className="page-header__actions">
            <button
              aria-label="Options"
              className="icon-button"
              onClick={openSettings}
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
            <details className="add-menu">
              <summary
                aria-haspopup="menu"
                aria-label="Add widget"
                className="icon-button"
                role="button">
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
                <button
                  className="menu-button"
                  onClick={() => addItem("clock")}
                  type="button">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="22"
                    viewBox="0 0 24 24"
                    width="22">
                    <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M12 7.5v5l3.5 2.1"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                  Add clock
                </button>
                <button
                  className="menu-button"
                  onClick={() => addItem("countdown")}
                  type="button">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="22"
                    viewBox="0 0 24 24"
                    width="22">
                    <path
                      d="M8 4h8M8 20h8M9 4c0 3.8 1.5 5.6 3 7 1.5-1.4 3-3.2 3-7M9 20c0-3.8 1.5-5.6 3-7 1.5 1.4 3 3.2 3 7"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                  Add countdown
                </button>
                <button
                  className="menu-button"
                  onClick={() => addItem("note")}
                  type="button">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="22"
                    viewBox="0 0 24 24"
                    width="22">
                    <path
                      d="M5 4.5h14a1 1 0 0 1 1 1V14l-6 5.5H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M20 14h-5a1 1 0 0 0-1 1v4.5"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M8 9h8M8 12.5h5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.6"
                    />
                  </svg>
                  Add note
                </button>
                <button
                  className="menu-button"
                  onClick={() => addItem("quote")}
                  type="button">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="22"
                    viewBox="0 0 24 24"
                    width="22">
                    <path
                      d="M10 7.5C7.5 8.3 6 10.3 6 13v3.5h4.5V12H8.4c.2-1.3 1-2.2 2.3-2.7L10 7.5ZM19 7.5c-2.5.8-4 2.8-4 5.5v3.5h4.5V12h-2.1c.2-1.3 1-2.2 2.3-2.7L19 7.5Z"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                    />
                  </svg>
                  Add quote
                </button>
                <button
                  className="menu-button"
                  onClick={() => addItem("stopwatch")}
                  type="button">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="22"
                    viewBox="0 0 24 24"
                    width="22">
                    <circle cx="12" cy="13.5" r="7.25" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M12 13.5V9.5M9.5 2.75h5M18.5 7l1.4-1.4"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                  Add stopwatch
                </button>
                <button
                  className="menu-button"
                  onClick={() => addItem("timer")}
                  type="button">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="22"
                    viewBox="0 0 24 24"
                    width="22">
                    <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M12 13 15 10"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                  Add timer
                </button>
                <button
                  className="menu-button"
                  onClick={() => addItem("habit")}
                  type="button">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="22"
                    viewBox="0 0 24 24"
                    width="22">
                    <path
                      d="m12 4.5 2.1 4.6 5 .5-3.7 3.4 1 4.9L12 16l-4.4 2.4 1-4.9L4.9 9.6l5-.5z"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.7"
                    />
                  </svg>
                  Add habit
                </button>
              </div>
            </details>
          </div>
        </header>
        <BoardList
          items={activeWidgets}
          now={now}
          draggable={state.settings.dragToMove}
          columns={state.settings.columns}
          timerChime={state.settings.chimeOnTimerEnd}
          onReorder={reorderList}
          onWidgetChange={updateWidget}
          onArchive={(id) => void setWidgets(archiveWidget(state.widgets, id))}
          renderItemActions={(item, index) => (
            <>
              <button
                aria-label={`Move ${item.title} up`}
                className="menu-button"
                disabled={index === 0}
                onClick={() => reorderItem(item.id, -1)}
                role="menuitem"
                type="button">
                Move up
              </button>
              <button
                aria-label={`Move ${item.title} down`}
                className="menu-button"
                disabled={index === activeWidgets.length - 1}
                onClick={() => reorderItem(item.id, 1)}
                role="menuitem"
                type="button">
                Move down
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
                Edit
              </button>
              <button
                aria-label={`Archive ${item.title}`}
                className="menu-button"
                onClick={() => archiveItem(item)}
                role="menuitem"
                type="button">
                Archive
              </button>
              <button
                aria-label={`Delete ${item.title}`}
                className="menu-button menu-button--danger"
                onClick={() => {
                  closeOpenMenus()
                  setItemPendingDelete(item)
                }}
                role="menuitem"
                type="button">
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
              {showArchived
                ? "Hide archived"
                : `Show archived (${archivedWidgets.length})`}
            </button>
            {showArchived ? (
              <BoardList
                items={archivedWidgets}
                now={now}
                draggable={state.settings.dragToMove}
                columns={state.settings.columns}
                timerChime={state.settings.chimeOnTimerEnd}
                onReorder={reorderList}
                onWidgetChange={updateWidget}
                onRestore={(id) => void setWidgets(restoreWidget(state.widgets, id))}
                renderItemActions={(item) => (
                  <>
                    <button
                      aria-label={`Restore ${item.title}`}
                      className="menu-button"
                      onClick={() => restoreItem(item)}
                      role="menuitem"
                      type="button">
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
                      Edit
                    </button>
                    <button
                      aria-label={`Delete ${item.title}`}
                      className="menu-button menu-button--danger"
                      onClick={() => {
                        closeOpenMenus()
                        setItemPendingDelete(item)
                      }}
                      role="menuitem"
                      type="button">
                      Delete
                    </button>
                  </>
                )}
              />
            ) : null}
          </section>
        ) : null}
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
