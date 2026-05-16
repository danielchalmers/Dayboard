import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useEffect, useState, type ReactNode } from "react"

import { BoardRow } from "~/components/BoardRow"
import type { Widget } from "~/lib/types"

interface BoardListProps {
  items: Widget[]
  now: Date
  compact?: boolean
  emptyDescription?: string
  emptyTitle?: string
  renderItemActions?: (item: Widget, index: number, items: Widget[]) => ReactNode
  onReorder?: (activeId: string, overId: string) => void
}

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)

    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  return prefersReducedMotion
}

interface SortableBoardRowProps {
  item: Widget
  items: Widget[]
  index: number
  now: Date
  compact?: boolean
  activeId: string | null
  renderItemActions?: (item: Widget, index: number, items: Widget[]) => ReactNode
  prefersReducedMotion: boolean
}

const SortableBoardRow = ({
  item,
  items,
  index,
  now,
  compact,
  activeId,
  renderItemActions,
  prefersReducedMotion
}: SortableBoardRowProps) => {
  const {
    attributes,
    listeners,
    isDragging,
    isOver,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: item.id
  })

  const actions = renderItemActions?.(item, index, items)
  const className = [
    "board-row--sortable",
    isDragging ? "board-row--dragging" : "",
    activeId && activeId !== item.id && isOver ? "board-row--drop-target" : ""
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <BoardRow
      actions={
        <>
          <button
            aria-label={`Reorder ${item.title}`}
            className="icon-button drag-handle"
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}>
            <svg
              aria-hidden="true"
              className="drag-handle__icon"
              fill="none"
              height="18"
              viewBox="0 0 18 18"
              width="18">
              <circle cx="6" cy="4.5" fill="currentColor" r="1.25" />
              <circle cx="6" cy="9" fill="currentColor" r="1.25" />
              <circle cx="6" cy="13.5" fill="currentColor" r="1.25" />
              <circle cx="12" cy="4.5" fill="currentColor" r="1.25" />
              <circle cx="12" cy="9" fill="currentColor" r="1.25" />
              <circle cx="12" cy="13.5" fill="currentColor" r="1.25" />
            </svg>
          </button>
          {actions}
        </>
      }
      className={className}
      compact={compact}
      item={item}
      now={now}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: prefersReducedMotion ? undefined : transition
      }}
    />
  )
}

export const BoardList = ({
  items,
  now,
  compact,
  emptyDescription = "Add a clock or countdown and it will appear here.",
  emptyTitle = "Your board is ready",
  renderItemActions,
  onReorder
}: BoardListProps) => {
  const [activeId, setActiveId] = useState<string | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
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

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
      </div>
    )
  }

  const itemIds = items.map((item) => item.id)

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)

    if (!over || active.id === over.id) {
      return
    }

    onReorder?.(String(active.id), String(over.id))
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <section
          className={compact ? "board-list board-list--compact" : "board-list"}
          aria-label="Clockboard widgets">
          {items.map((item, index) => (
            <SortableBoardRow
              activeId={activeId}
              compact={compact}
              index={index}
              item={item}
              items={items}
              key={item.id}
              now={now}
              prefersReducedMotion={prefersReducedMotion}
              renderItemActions={renderItemActions}
            />
          ))}
        </section>
      </SortableContext>
    </DndContext>
  )
}
