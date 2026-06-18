import { useEffect, useState } from "react"

import { BoardList } from "~/components/BoardList"
import { DeleteDialog } from "~/components/DeleteDialog"
import { ItemDialog } from "~/components/ItemDialog"
import { ErrorView, LoadingView } from "~/components/StatusViews"
import { useClockboardState } from "~/hooks/useClockboardState"
import { useNow } from "~/hooks/useNow"
import { createWidget, moveWidget, reorderWidgets } from "~/lib/widgets"
import type { Widget } from "~/lib/types"

interface EditorState {
  mode: "add" | "edit"
  item: Widget
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
  const { state, isLoading, error, setWidgets } = useClockboardState()
  const [editorState, setEditorState] = useState<EditorState | null>(null)
  const [itemPendingDelete, setItemPendingDelete] = useState<Widget | null>(null)

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

  const addItem = (kind: Widget["kind"]) => {
    closeOpenMenus()
    setEditorState({
      mode: "add",
      item: createWidget(kind)
    })
  }

  return (
    <>
      <main className="page">
        <header className="page-header">
          <div>
            <h1>Clockboard</h1>
          </div>
          <div className="page-header__actions">
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
              </div>
            </details>
          </div>
        </header>
        <BoardList
          items={state.widgets}
          now={now}
          onReorder={reorderList}
          renderItemActions={(item, index) => (
            <>
              <button
                aria-label={`Move ${item.title} up`}
                className="menu-button"
                disabled={index === 0}
                onClick={() => reorderItem(item.id, -1)}
                type="button">
                Move up
              </button>
              <button
                aria-label={`Move ${item.title} down`}
                className="menu-button"
                disabled={index === state.widgets.length - 1}
                onClick={() => reorderItem(item.id, 1)}
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
                type="button">
                Delete
              </button>
            </>
          )}
        />
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
    </>
  )
}
