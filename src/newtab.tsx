import { useState } from "react"

import { BoardList } from "~/components/BoardList"
import { DeleteDialog } from "~/components/DeleteDialog"
import { ItemDialog } from "~/components/ItemDialog"
import { ErrorView, LoadingView } from "~/components/StatusViews"
import { useClockboardState } from "~/hooks/useClockboardState"
import { useNow } from "~/hooks/useNow"
import { createBoardItem, moveBoardItem } from "~/lib/items"
import type { BoardItem } from "~/lib/types"
import "~/styles/global.css"

interface EditorState {
  mode: "add" | "edit"
  item: BoardItem
}

export default function NewTabPage() {
  const now = useNow()
  const { state, isLoading, error, setItems } = useClockboardState()
  const [editorState, setEditorState] = useState<EditorState | null>(null)
  const [itemPendingDelete, setItemPendingDelete] = useState<BoardItem | null>(null)

  if (isLoading) {
    return <LoadingView />
  }

  if (error || !state) {
    return <ErrorView message={error || "Unable to load Clockboard"} />
  }

  const saveItem = (item: BoardItem) => {
    const nextItems =
      editorState?.mode === "edit"
        ? state.items.map((current) => (current.id === item.id ? item : current))
        : [...state.items, item]

    void setItems(nextItems)
    setEditorState(null)
  }

  const reorderItem = (id: string, direction: -1 | 1) => {
    void setItems(moveBoardItem(state.items, id, direction))
  }

  const deleteItem = (item: BoardItem) => {
    void setItems(state.items.filter((current) => current.id !== item.id))
    setItemPendingDelete(null)
  }

  return (
    <>
      <main className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Today</p>
            <h1>{state.settings.boardTitle}</h1>
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
                  item: createBoardItem("clock")
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
                  item: createBoardItem("countdown")
                })
              }
              type="button">
              Add countdown
            </button>
          </div>
        </header>
        <BoardList
          items={state.items}
          now={now}
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
                disabled={index === state.items.length - 1}
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
          settings={state.settings}
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
