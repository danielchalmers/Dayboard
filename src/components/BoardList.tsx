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
import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react"

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
  isMenuOpen: boolean
  renderItemActions?: (item: Widget, index: number) => ReactNode
  prefersReducedMotion: boolean
  onCloseMenu: () => void
  onOpenMenu: (id: string) => void
}

const SortableBoardRow = ({
  item,
  index,
  now,
  compact,
  activeId,
  isMenuOpen,
  renderItemActions,
  prefersReducedMotion,
  onCloseMenu,
  onOpenMenu
}: SortableBoardRowProps) => {
  const {
    listeners,
    isDragging,
    isOver,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: item.id
  })

  const actions = renderItemActions?.(item, index)
  const className = [
    "board-row--sortable",
    "board-row--draggable",
    isMenuOpen ? "board-row--menu-open" : "",
    isDragging ? "board-row--dragging" : "",
    activeId && activeId !== item.id && isOver ? "board-row--drop-target" : ""
  ]
    .filter(Boolean)
    .join(" ")

  const handleContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (!actions) {
      return
    }

    event.preventDefault()
    onOpenMenu(item.id)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!actions) {
      listeners?.onKeyDown?.(event)
      return
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault()
      onOpenMenu(item.id)
      return
    }

    if (event.key === "Escape" && isMenuOpen) {
      event.preventDefault()
      onCloseMenu()
      return
    }

    listeners?.onKeyDown?.(event)
  }

  return (
    <BoardRow
      actions={
        actions && isMenuOpen ? (
          <div className="card-menu">
            <div
              aria-label={`Actions for ${item.title}`}
              className="card-menu__panel"
              onClick={onCloseMenu}>
              {actions}
            </div>
          </div>
        ) : null
      }
      articleProps={{
        ...listeners,
        "aria-haspopup": actions ? "menu" : undefined,
        onContextMenu: handleContextMenu,
        onKeyDown: handleKeyDown,
        tabIndex: 0
      }}
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
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

  useEffect(() => {
    if (!openMenuId) {
      return
    }

    const closeMenuOnPointerDownOutside = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Element && target.closest(".card-menu")) {
        return
      }

      setOpenMenuId(null)
    }

    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null)
      }
    }

    window.addEventListener("pointerdown", closeMenuOnPointerDownOutside)
    window.addEventListener("keydown", closeMenuOnEscape)

    return () => {
      window.removeEventListener("pointerdown", closeMenuOnPointerDownOutside)
      window.removeEventListener("keydown", closeMenuOnEscape)
    }
  }, [openMenuId])

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>Your board is ready</h2>
        <p>Add a clock or countdown and it will appear here.</p>
      </div>
    )
  }

  const itemIds = items.map((item) => item.id)

  const closeOpenDetailsMenus = () => {
    document.querySelectorAll<HTMLDetailsElement>(".add-menu[open]").forEach((menu) => {
      menu.removeAttribute("open")
    })
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setOpenMenuId(null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    setOpenMenuId(null)

    if (!over || active.id === over.id) {
      return
    }

    onReorder?.(String(active.id), String(over.id))
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setOpenMenuId(null)
  }

  const openMenu = (id: string) => {
    closeOpenDetailsMenus()
    setOpenMenuId(id)
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
              isMenuOpen={openMenuId === item.id}
              index={index}
              item={item}
              key={item.id}
              now={now}
              onCloseMenu={() => setOpenMenuId(null)}
              onOpenMenu={openMenu}
              prefersReducedMotion={prefersReducedMotion}
              renderItemActions={renderItemActions}
            />
          ))}
        </section>
      </SortableContext>
    </DndContext>
  )
}
