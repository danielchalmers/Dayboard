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
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react"
import { createPortal } from "react-dom"

import { BoardRow } from "~/components/BoardRow"
import type { Widget } from "~/lib/types"

interface BoardListProps {
  items: Widget[]
  now: Date
  renderItemActions?: (item: Widget, index: number) => ReactNode
  onReorder?: (activeId: string, overId: string) => void
}

interface OpenMenu {
  id: string
  x: number
  y: number
}

const MENU_VIEWPORT_MARGIN = 8
const MENU_KEYBOARD_OFFSET = 16

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

interface WidgetContextMenuProps {
  x: number
  y: number
  label: string
  onClose: () => void
  children: ReactNode
}

const getMenuItems = (panel: HTMLElement) =>
  Array.from(panel.querySelectorAll<HTMLButtonElement>("button:not([disabled])"))

// A free-form context menu that spawns under the cursor and is portaled to the
// document body so it can break free of the card's clipped, overflow-hidden bounds.
const WidgetContextMenu = ({
  x,
  y,
  label,
  onClose,
  children
}: WidgetContextMenuProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })
  // Selecting an action manages focus itself (opens a dialog, reorders), so only
  // restore focus to the opener when the menu is dismissed rather than acted on.
  const restoreFocusRef = useRef(true)

  // Keep the menu fully on screen by nudging it back inside the viewport once we
  // can measure its rendered size. Runs before paint to avoid a visible jump.
  // offsetWidth/Height read the settled layout box, ignoring the scale-up
  // animation transform so we clamp against the menu's real size.
  useLayoutEffect(() => {
    const panel = panelRef.current

    if (!panel) {
      return
    }

    const maxLeft = window.innerWidth - panel.offsetWidth - MENU_VIEWPORT_MARGIN
    const maxTop = window.innerHeight - panel.offsetHeight - MENU_VIEWPORT_MARGIN
    const left = Math.max(MENU_VIEWPORT_MARGIN, Math.min(x, maxLeft))
    const top = Math.max(MENU_VIEWPORT_MARGIN, Math.min(y, maxTop))

    setPosition({ left, top })
  }, [x, y])

  // The menu is portaled out of the card and its tab order, so move focus into it
  // when it opens (keyboard users could not otherwise reach it) and return focus
  // to the opener when it is dismissed.
  useEffect(() => {
    const panel = panelRef.current

    if (!panel) {
      return
    }

    const opener = document.activeElement as HTMLElement | null
    getMenuItems(panel)[0]?.focus()

    return () => {
      if (restoreFocusRef.current && opener?.isConnected) {
        opener.focus()
      }
    }
  }, [])

  const handleClick = () => {
    restoreFocusRef.current = false
    onClose()
  }

  // Trap Tab within the menu so focus cannot wander into the page behind it.
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") {
      return
    }

    const panel = panelRef.current

    if (!panel) {
      return
    }

    const items = getMenuItems(panel)
    const first = items[0]
    const last = items[items.length - 1]

    if (!first || !last) {
      return
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className="card-menu"
      style={{ left: position.left, top: position.top }}>
      <div
        aria-label={label}
        className="card-menu__panel"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        ref={panelRef}>
        {children}
      </div>
    </div>,
    document.body
  )
}

interface SortableBoardRowProps {
  item: Widget
  now: Date
  activeId: string | null
  isMenuOpen: boolean
  hasActions: boolean
  prefersReducedMotion: boolean
  onCloseMenu: () => void
  onOpenMenu: (id: string, x: number, y: number) => void
}

const SortableBoardRow = ({
  item,
  now,
  activeId,
  isMenuOpen,
  hasActions,
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
    if (!hasActions) {
      return
    }

    event.preventDefault()
    onOpenMenu(item.id, event.clientX, event.clientY)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!hasActions) {
      listeners?.onKeyDown?.(event)
      return
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault()
      // Keyboard activation has no cursor, so anchor near the card's corner.
      const rect = event.currentTarget.getBoundingClientRect()
      onOpenMenu(
        item.id,
        rect.left + MENU_KEYBOARD_OFFSET,
        rect.top + MENU_KEYBOARD_OFFSET
      )
      return
    }

    if (event.key === "Escape" && isMenuOpen) {
      event.preventDefault()
      onCloseMenu()
      return
    }

    if (isMenuOpen) {
      return
    }

    listeners?.onKeyDown?.(event)
  }

  return (
    <BoardRow
      articleProps={{
        ...listeners,
        "aria-haspopup": hasActions ? "menu" : undefined,
        onContextMenu: handleContextMenu,
        onKeyDown: handleKeyDown,
        tabIndex: 0
      }}
      className={className}
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
  renderItemActions,
  onReorder
}: BoardListProps) => {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null)
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
    if (!openMenu) {
      return
    }

    const closeMenu = () => setOpenMenu(null)

    const closeMenuOnPointerDownOutside = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Element && target.closest(".card-menu")) {
        return
      }

      closeMenu()
    }

    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu()
      }
    }

    window.addEventListener("pointerdown", closeMenuOnPointerDownOutside)
    window.addEventListener("keydown", closeMenuOnEscape)
    // A fixed menu would drift away from its anchor on scroll or resize, so close it.
    window.addEventListener("resize", closeMenu)
    window.addEventListener("scroll", closeMenu, true)

    return () => {
      window.removeEventListener("pointerdown", closeMenuOnPointerDownOutside)
      window.removeEventListener("keydown", closeMenuOnEscape)
      window.removeEventListener("resize", closeMenu)
      window.removeEventListener("scroll", closeMenu, true)
    }
  }, [openMenu])

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>Your board is ready</h2>
        <p>Add a clock or countdown and it will appear here.</p>
      </div>
    )
  }

  const itemIds = items.map((item) => item.id)
  const hasActions = Boolean(renderItemActions)

  const closeAddMenu = () => {
    document.querySelectorAll<HTMLDetailsElement>(".add-menu[open]").forEach((menu) => {
      menu.removeAttribute("open")
    })
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setOpenMenu(null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    setOpenMenu(null)

    if (!over || active.id === over.id) {
      return
    }

    onReorder?.(String(active.id), String(over.id))
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setOpenMenu(null)
  }

  const closeMenu = () => setOpenMenu(null)

  const handleOpenMenu = (id: string, x: number, y: number) => {
    closeAddMenu()
    setOpenMenu({ id, x, y })
  }

  const activeMenuItem = openMenu
    ? items.find((item) => item.id === openMenu.id) ?? null
    : null
  const activeMenuIndex = activeMenuItem ? items.indexOf(activeMenuItem) : -1

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}>
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <section
          className={[
            "board-list",
            activeId ? "board-list--dragging" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Clockboard widgets">
          {items.map((item) => (
            <SortableBoardRow
              activeId={activeId}
              hasActions={hasActions}
              isMenuOpen={openMenu?.id === item.id}
              item={item}
              key={item.id}
              now={now}
              onCloseMenu={closeMenu}
              onOpenMenu={handleOpenMenu}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </section>
      </SortableContext>
      {openMenu && activeMenuItem && renderItemActions ? (
        <WidgetContextMenu
          label={`Actions for ${activeMenuItem.title}`}
          onClose={closeMenu}
          x={openMenu.x}
          y={openMenu.y}>
          {renderItemActions(activeMenuItem, activeMenuIndex)}
        </WidgetContextMenu>
      ) : null}
    </DndContext>
  )
}
