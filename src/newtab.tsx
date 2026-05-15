import { useState } from "react"

import { BoardList } from "~/components/BoardList"
import { DeleteDialog } from "~/components/DeleteDialog"
import { ItemDialog } from "~/components/ItemDialog"
import { ErrorView, LoadingView } from "~/components/StatusViews"
import { useClockboardState } from "~/hooks/useClockboardState"
import { useNow } from "~/hooks/useNow"
import {
  createWidget,
  getWidgetsByPlacement,
  moveWidgetToPlacement,
  reorderWidgetsInPlacement
} from "~/lib/widgets"
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

  const mainWidgets = getWidgetsByPlacement(state.widgets, "main")
  const moreWidgets = getWidgetsByPlacement(state.widgets, "more")

  const saveItem = (item: Widget) => {
    const nextWidgets =
      editorState?.mode === "edit"
        ? state.widgets.map((current) => (current.id === item.id ? item : current))
        : item.placement === "main"
          ? [...mainWidgets, item, ...moreWidgets]
          : [...mainWidgets, ...moreWidgets, item]

    void setWidgets(nextWidgets)
    setEditorState(null)
  }

  const reorderItem = (item: Widget, index: number, direction: -1 | 1) => {
    const placementWidgets = getWidgetsByPlacement(state.widgets, item.placement)
    const targetWidget = placementWidgets[index + direction]

    if (!targetWidget) {
      return
    }

    void setWidgets(
      reorderWidgetsInPlacement(state.widgets, item.placement, item.id, targetWidget.id)
    )
  }

  const reorderList = (
    placement: Widget["placement"],
    activeId: string,
    overId: string
  ) => {
    void setWidgets(reorderWidgetsInPlacement(state.widgets, placement, activeId, overId))
  }

  const moveItemPlacement = (item: Widget, placement: Widget["placement"]) => {
    void setWidgets(moveWidgetToPlacement(state.widgets, item.id, placement))
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
          ariaLabel="Main widgets"
          emptyState={state.widgets.length === 0 ? undefined : null}
          items={mainWidgets}
          now={now}
          onReorder={(activeId, overId) => reorderList("main", activeId, overId)}
          renderItemActions={(item, index) => (
            <>
              <button
                aria-label={`Move ${item.title} up`}
                className="icon-button"
                disabled={index === 0}
                onClick={() => reorderItem(item, index, -1)}
                type="button">
                ↑
              </button>
              <button
                aria-label={`Move ${item.title} down`}
                className="icon-button"
                disabled={index === mainWidgets.length - 1}
                onClick={() => reorderItem(item, index, 1)}
                type="button">
                ↓
              </button>
              <button
                aria-label={`Move ${item.title} to More`}
                className="secondary-button"
                onClick={() => moveItemPlacement(item, "more")}
                type="button">
                Move to More
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
        {moreWidgets.length > 0 ? (
          <details className="more-section" open>
            <summary className="more-section__summary">
              <span>More</span>
              <span className="more-section__count">{moreWidgets.length}</span>
            </summary>
            <BoardList
              ariaLabel="More widgets"
              items={moreWidgets}
              now={now}
              onReorder={(activeId, overId) => reorderList("more", activeId, overId)}
              renderItemActions={(item, index) => (
                <>
                  <button
                    aria-label={`Move ${item.title} up`}
                    className="icon-button"
                    disabled={index === 0}
                    onClick={() => reorderItem(item, index, -1)}
                    type="button">
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${item.title} down`}
                    className="icon-button"
                    disabled={index === moreWidgets.length - 1}
                    onClick={() => reorderItem(item, index, 1)}
                    type="button">
                    ↓
                  </button>
                  <button
                    aria-label={`Move ${item.title} to Main`}
                    className="secondary-button"
                    onClick={() => moveItemPlacement(item, "main")}
                    type="button">
                    Move to Main
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
          </details>
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
    </>
  )
}
