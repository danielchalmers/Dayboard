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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useEffect, useState, type ReactNode } from "react"

import { BoardRow } from "~/components/BoardRow"
import type { Widget } from "~/lib/types"

interface BoardListProps {
  items: Widget[]
  now: Date
  compact?: boolean
  renderItemActions?: (item: Widget, index: number) => ReactNode
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
  index: number
  now: Date
  compact?: boolean
  activeId: string | null
  renderItemActions?: (item: Widget, index: number) => ReactNode
  prefersReducedMotion: boolean
}

const SortableBoardRow = ({
  item,
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

  const actions = renderItemActions?.(item, index)
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
        <details className="card-menu">
          <summary
            aria-haspopup="menu"
            aria-label={`Actions for ${item.title}`}
            className="icon-button"
            role="button">
            <svg
              aria-hidden="true"
              fill="none"
              height="20"
              viewBox="0 0 20 20"
              width="20">
              <circle cx="10" cy="4.5" fill="currentColor" r="1.5" />
              <circle cx="10" cy="10" fill="currentColor" r="1.5" />
              <circle cx="10" cy="15.5" fill="currentColor" r="1.5" />
            </svg>
          </summary>
          <div className="card-menu__panel">
          <button
            aria-label={`Reorder ${item.title}`}
            className="menu-button drag-handle"
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}>
            Drag to reorder
          </button>
            {actions}
          </div>
        </details>
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
        <h2>Your board is ready</h2>
        <p>Add a clock or countdown and it will appear here.</p>
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
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <section
          className={compact ? "board-list board-list--compact" : "board-list"}
          aria-label="Clockboard widgets">
          {items.map((item, index) => (
            <SortableBoardRow
              activeId={activeId}
              compact={compact}
              index={index}
              item={item}
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
