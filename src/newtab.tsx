import { useEffect, useState } from "react"

import { AddWidgetDialog } from "~/components/AddWidgetDialog"
import { BoardList } from "~/components/BoardList"
import { DeleteDialog } from "~/components/DeleteDialog"
import { ItemDialog } from "~/components/ItemDialog"
import { SettingsDialog } from "~/components/SettingsDialog"
import { ErrorView, LoadingView } from "~/components/StatusViews"
import { useClockboardState } from "~/hooks/useClockboardState"
import { useNow } from "~/hooks/useNow"
import {
  createWidget,
  getWidgetsByPlacement,
  moveWidgetToPlacement,
  moveWidgetWithinPlacement,
  reorderWidgetsWithinPlacement
} from "~/lib/widgets"
import type { Widget, WidgetKind, WidgetPlacement } from "~/lib/types"
import "~/styles/global.css"

interface EditorState {
  mode: "add" | "edit"
  item: Widget
}

export default function NewTabPage() {
  const now = useNow()
  const { state, isLoading, error, setWidgets } = useClockboardState()
  const [editorState, setEditorState] = useState<EditorState | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [itemPendingDelete, setItemPendingDelete] = useState<Widget | null>(null)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const moreWidgetCount =
    state?.widgets.filter((widget) => widget.placement === "more").length ?? 0

  useEffect(() => {
    if (moreWidgetCount === 0) {
      setIsMoreOpen(false)
    }
  }, [moreWidgetCount])

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
        : [...state.widgets, item]

    void setWidgets(nextWidgets)
    setEditorState(null)
  }

  const reorderItem = (id: string, direction: -1 | 1) => {
    void setWidgets(moveWidgetWithinPlacement(state.widgets, id, direction))
  }

  const reorderList = (activeId: string, overId: string) => {
    void setWidgets(reorderWidgetsWithinPlacement(state.widgets, activeId, overId))
  }

  const moveItemToPlacement = (id: string, placement: WidgetPlacement) => {
    void setWidgets(moveWidgetToPlacement(state.widgets, id, placement))

    if (placement === "more") {
      setIsMoreOpen(true)
    }
  }

  const addWidget = (kind: WidgetKind) => {
    setIsAddDialogOpen(false)
    setEditorState({
      mode: "add",
      item: createWidget(kind)
    })
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
              onClick={() => setIsSettingsDialogOpen(true)}
              type="button">
              Settings
            </button>
            <button
              className="primary-button"
              onClick={() => setIsAddDialogOpen(true)}
              type="button">
              Add widget
            </button>
          </div>
        </header>
        <BoardList
          emptyDescription={
            moreWidgets.length > 0
              ? "Move a widget out of More when you want it at a glance."
              : undefined
          }
          emptyTitle={moreWidgets.length > 0 ? "Main is clear" : undefined}
          items={mainWidgets}
          now={now}
          onReorder={reorderList}
          renderItemActions={(item, index, items) => (
            <WidgetActions
              index={index}
              item={item}
              items={items}
              onDelete={setItemPendingDelete}
              onEdit={(itemToEdit) =>
                setEditorState({ mode: "edit", item: itemToEdit })
              }
              onMovePlacement={moveItemToPlacement}
              onReorder={reorderItem}
            />
          )}
        />
        {moreWidgets.length > 0 ? (
          <section className="more-section" aria-label="More widgets">
            <button
              aria-expanded={isMoreOpen}
              className="more-section__toggle"
              onClick={() => setIsMoreOpen((current) => !current)}
              type="button">
              <span>More</span>
              <span className="more-section__count">{moreWidgets.length}</span>
            </button>
            {isMoreOpen ? (
              <BoardList
                compact
                items={moreWidgets}
                now={now}
                onReorder={reorderList}
                renderItemActions={(item, index, items) => (
                  <WidgetActions
                    index={index}
                    item={item}
                    items={items}
                    onDelete={setItemPendingDelete}
                    onEdit={(itemToEdit) =>
                      setEditorState({ mode: "edit", item: itemToEdit })
                    }
                    onMovePlacement={moveItemToPlacement}
                    onReorder={reorderItem}
                  />
                )}
              />
            ) : null}
          </section>
        ) : null}
      </main>
      <AddWidgetDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSelectKind={addWidget}
      />
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
        isOpen={isSettingsDialogOpen}
        onClose={() => setIsSettingsDialogOpen(false)}
      />
    </>
  )
}

interface WidgetActionsProps {
  item: Widget
  index: number
  items: Widget[]
  onDelete: (item: Widget) => void
  onEdit: (item: Widget) => void
  onMovePlacement: (id: string, placement: WidgetPlacement) => void
  onReorder: (id: string, direction: -1 | 1) => void
}

const WidgetActions = ({
  item,
  index,
  items,
  onDelete,
  onEdit,
  onMovePlacement,
  onReorder
}: WidgetActionsProps) => {
  const nextPlacement = item.placement === "main" ? "more" : "main"
  const nextPlacementLabel = nextPlacement === "main" ? "Main" : "More"

  return (
    <>
      <button
        aria-label={`Move ${item.title} up`}
        className="icon-button"
        disabled={index === 0}
        onClick={() => onReorder(item.id, -1)}
        type="button">
        ↑
      </button>
      <button
        aria-label={`Move ${item.title} down`}
        className="icon-button"
        disabled={index === items.length - 1}
        onClick={() => onReorder(item.id, 1)}
        type="button">
        ↓
      </button>
      <button
        aria-label={`Move ${item.title} to ${nextPlacementLabel}`}
        className="secondary-button"
        onClick={() => onMovePlacement(item.id, nextPlacement)}
        type="button">
        {nextPlacementLabel}
      </button>
      <button
        aria-label={`Edit ${item.title}`}
        className="secondary-button"
        onClick={() => onEdit(item)}
        type="button">
        Edit
      </button>
      <button
        aria-label={`Delete ${item.title}`}
        className="danger-button"
        onClick={() => onDelete(item)}
        type="button">
        Delete
      </button>
    </>
  )
}
