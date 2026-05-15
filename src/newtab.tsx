import { useState } from "react"

import { BoardList } from "~/components/BoardList"
import { DeleteDialog } from "~/components/DeleteDialog"
import { ItemDialog } from "~/components/ItemDialog"
import { ErrorView, LoadingView } from "~/components/StatusViews"
import { useClockboardState } from "~/hooks/useClockboardState"
import { useNow } from "~/hooks/useNow"
import { createWidget, moveWidget, reorderWidgets } from "~/lib/widgets"
import type { Widget } from "~/lib/types"
import "~/styles/global.css"

interface EditorState {
  mode: "add" | "edit"
  item: Widget
}

export default function NewTabPage() {
  const now = useNow()
  const { state, isLoading, error, setWidgets } = useClockboardState()
  const [editorState, setEditorState] = useState<EditorState | null>(null)
  const [itemPendingDelete, setItemPendingDelete] = useState<Widget | null>(null)

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
    void setWidgets(moveWidget(state.widgets, id, direction))
  }

  const reorderList = (activeId: string, overId: string) => {
    void setWidgets(reorderWidgets(state.widgets, activeId, overId))
  }

  const deleteItem = (item: Widget) => {
    void setWidgets(state.widgets.filter((current) => current.id !== item.id))
    setItemPendingDelete(null)
  }

  return (
    <>
      <main className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Today</p>
            <h1>Clockboard</h1>
            <p className="page-header__subtitle">
              {new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
              }).format(now)}
            </p>
          </div>
          <div className="page-header__actions">
            <button
              className="secondary-button"
              onClick={() =>
                setEditorState({
                  mode: "add",
                  item: createWidget("clock")
                })
              }
              type="button">
              Add clock
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                setEditorState({
                  mode: "add",
                  item: createWidget("countdown")
                })
              }
              type="button">
              Add countdown
            </button>
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
                className="icon-button"
                disabled={index === 0}
                onClick={() => reorderItem(item.id, -1)}
                type="button">
                ↑
              </button>
              <button
                aria-label={`Move ${item.title} down`}
                className="icon-button"
                disabled={index === state.widgets.length - 1}
                onClick={() => reorderItem(item.id, 1)}
                type="button">
                ↓
              </button>
              <button
                aria-label={`Edit ${item.title}`}
                className="secondary-button"
                onClick={() => setEditorState({ mode: "edit", item })}
                type="button">
                Edit
              </button>
              <button
                aria-label={`Delete ${item.title}`}
                className="danger-button"
                onClick={() => setItemPendingDelete(item)}
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
