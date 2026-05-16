import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useEffect, useState, type ReactNode } from "react"

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

const MORE_DROP_ZONE_ID = "more-drop-zone"

export default function NewTabPage() {
  const now = useNow()
  const { state, isLoading, error, setWidgets } = useClockboardState()
  const [editorState, setEditorState] = useState<EditorState | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [itemPendingDelete, setItemPendingDelete] = useState<Widget | null>(null)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )
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

  const getDragTargetPlacement = (
    overId: string
  ): WidgetPlacement | undefined => {
    if (overId === MORE_DROP_ZONE_ID) {
      return "more"
    }

    return state.widgets.find((widget) => widget.id === overId)?.placement
  }

  const moveDragItemToTarget = (activeId: string, overId: string): Widget[] => {
    const activeWidget = state.widgets.find((widget) => widget.id === activeId)
    const targetPlacement = getDragTargetPlacement(overId)

    if (!activeWidget || !targetPlacement) {
      return state.widgets
    }

    const placedWidgets =
      activeWidget.placement === targetPlacement
        ? state.widgets
        : moveWidgetToPlacement(state.widgets, activeId, targetPlacement)

    if (targetPlacement === "more") {
      setIsMoreOpen(true)
    }

    return overId === MORE_DROP_ZONE_ID
      ? placedWidgets
      : reorderWidgetsWithinPlacement(placedWidgets, activeId, overId)
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) {
      return
    }

    const nextWidgets = moveDragItemToTarget(String(active.id), String(over.id))

    if (nextWidgets !== state.widgets) {
      void setWidgets(nextWidgets)
    }
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)

    if (!over || active.id === over.id) {
      return
    }

    const nextWidgets = moveDragItemToTarget(String(active.id), String(over.id))

    if (nextWidgets !== state.widgets) {
      void setWidgets(nextWidgets)
    }
  }

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveId(null)
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
        <DndContext
          collisionDetection={closestCenter}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragStart={handleDragStart}
          sensors={sensors}>
          <BoardList
            activeId={activeId}
            emptyDescription={
              moreWidgets.length > 0
                ? "Move a widget out of More when you want it at a glance."
                : undefined
            }
            emptyTitle={moreWidgets.length > 0 ? "Main is clear" : undefined}
            items={mainWidgets}
            now={now}
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
          {moreWidgets.length > 0 || activeId ? (
            <MoreSection
              isDragging={Boolean(activeId)}
              isOpen={isMoreOpen}
              widgetCount={moreWidgets.length}
              onToggle={() => setIsMoreOpen((current) => !current)}>
              {isMoreOpen || activeId ? (
                <BoardList
                  activeId={activeId}
                  compact
                  emptyDescription="Drop a widget here to keep it tucked away."
                  emptyTitle="Drop into More"
                  items={moreWidgets}
                  now={now}
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
            </MoreSection>
          ) : null}
        </DndContext>
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

interface MoreSectionProps {
  children: ReactNode
  isDragging: boolean
  isOpen: boolean
  widgetCount: number
  onToggle: () => void
}

const MoreSection = ({
  children,
  isDragging,
  isOpen,
  widgetCount,
  onToggle
}: MoreSectionProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id: MORE_DROP_ZONE_ID
  })
  const isExpanded = isOpen || isDragging
  const className = [
    "more-section",
    isDragging ? "more-section--dragging" : "",
    isOver ? "more-section--drop-target" : ""
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <section className={className} aria-label="More widgets" ref={setNodeRef}>
      <button
        aria-expanded={isExpanded}
        className="more-section__toggle"
        onClick={onToggle}
        type="button">
        <span>More</span>
        <span className="more-section__count">{widgetCount}</span>
      </button>
      {isExpanded ? children : null}
    </section>
  )
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
