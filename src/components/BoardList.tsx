import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
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
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEventHandler,
  type ReactNode
} from "react"

import { BoardRow } from "~/components/BoardRow"
import type { BoardColumns, Widget } from "~/lib/types"

interface BoardListProps {
  items: Widget[]
  now: Date
  draggable?: boolean
  columns?: BoardColumns
  renderItemActions?: (item: Widget, index: number) => ReactNode
  onReorder?: (activeId: string, overId: string) => void
  onWidgetChange?: (widget: Widget) => void
  onArchive?: (id: string) => void
}

const ARCHIVE_DROP_ID = "clockboard-archive-dropzone"

// A drop target that only exists mid-drag: dropping a widget here archives it.
const ArchiveDropZone = () => {
  const { setNodeRef, isOver } = useDroppable({ id: ARCHIVE_DROP_ID })

  return (
    <div
      ref={setNodeRef}
      className={`archive-dropzone${isOver ? " archive-dropzone--over" : ""}`}
      aria-hidden="true">
      <svg
        fill="none"
        height="22"
        viewBox="0 0 24 24"
        width="22">
        <path
          d="M4 7.5h16M4 7.5 5.2 19a1.5 1.5 0 0 0 1.5 1.4h10.6a1.5 1.5 0 0 0 1.5-1.4L20 7.5M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M10 11.5v5M14 11.5v5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
      <span>{isOver ? "Release to archive" : "Drag here to archive"}</span>
    </div>
  )
}

// Interactive widgets (a note's textarea, a timer's buttons) own their key and
// right-click behavior, so the card must not hijack those events for dragging
// or its context menu when they originate inside such a control.
const FORM_FIELD_SELECTOR =
  "input, textarea, select, button, [contenteditable='true']"

const isFromInteractiveControl = (event: { target: EventTarget | null }) =>
  Boolean((event.target as HTMLElement | null)?.closest(FORM_FIELD_SELECTOR))

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

// A free-form context menu that spawns under the cursor. It uses the native
// Popover API so it renders in the top layer — escaping the card's clipped,
// overflow-hidden bounds — and gets light-dismiss + Escape handling for free.
const WidgetContextMenu = ({
  x,
  y,
  label,
  onClose,
  children
}: WidgetContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // onClose is recreated on every parent render (the board re-renders each tick).
  // Keep the latest in a ref so the mount-only effects don't re-run and steal focus.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Promote the menu to the top layer, move focus into it (it sits outside the
  // card's tab order), and mirror native dismissals (Escape / click-away) into React.
  useLayoutEffect(() => {
    const menu = menuRef.current
    const panel = panelRef.current

    if (!menu || !panel) {
      return
    }

    menu.setAttribute("popover", "auto")

    try {
      menu.showPopover()
    } catch {
      // Already shown — ignore.
    }

    // Focus without scrolling: a menu opened near the bottom of a scrollable
    // page would otherwise scroll the focused item into view, and that scroll
    // trips the close-on-scroll handler below, dismissing the menu instantly.
    getMenuItems(panel)[0]?.focus({ preventScroll: true })

    const handleToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === "closed") {
        onCloseRef.current()
      }
    }

    menu.addEventListener("toggle", handleToggle)

    return () => menu.removeEventListener("toggle", handleToggle)
  }, [])

  // Keep the menu on screen, measuring the settled layout box (offsetWidth/Height
  // ignore the scale-up transform so we clamp against the real size).
  useLayoutEffect(() => {
    const panel = panelRef.current

    if (!panel) {
      return
    }

    const maxLeft = window.innerWidth - panel.offsetWidth - MENU_VIEWPORT_MARGIN
    const maxTop = window.innerHeight - panel.offsetHeight - MENU_VIEWPORT_MARGIN

    setPosition({
      left: Math.max(MENU_VIEWPORT_MARGIN, Math.min(x, maxLeft)),
      top: Math.max(MENU_VIEWPORT_MARGIN, Math.min(y, maxTop))
    })
  }, [x, y])

  // A viewport-fixed menu drifts away from its card on scroll or resize, so close
  // it. Hide it through the Popover API (not a bare React unmount) so the browser
  // runs its native focus-restoration and returns focus to the opener; the
  // resulting toggle event then clears the React state.
  useEffect(() => {
    const close = () => {
      const menu = menuRef.current

      if (menu) {
        menu.hidePopover()
      } else {
        onCloseRef.current()
      }
    }

    window.addEventListener("resize", close)
    window.addEventListener("scroll", close, true)

    return () => {
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [])

  // Arrow keys move between items; Tab is trapped so focus stays inside the menu.
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const panel = panelRef.current

    if (!panel) {
      return
    }

    const items = getMenuItems(panel)

    if (items.length === 0) {
      return
    }

    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const focusItem = (index: number) =>
      items[((index % items.length) + items.length) % items.length]?.focus({
        preventScroll: true
      })

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        focusItem(current + 1)
        break
      case "ArrowUp":
        event.preventDefault()
        focusItem(current < 0 ? items.length - 1 : current - 1)
        break
      case "Home":
        event.preventDefault()
        focusItem(0)
        break
      case "End":
        event.preventDefault()
        focusItem(items.length - 1)
        break
      case "Tab":
        event.preventDefault()
        focusItem(
          event.shiftKey
            ? current < 0
              ? items.length - 1
              : current - 1
            : current + 1
        )
        break
    }
  }

  return (
    <div
      className="card-menu"
      ref={menuRef}
      style={{ left: position.left, top: position.top }}>
      <div
        aria-label={label}
        className="card-menu__panel"
        onClick={onClose}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="menu">
        {children}
      </div>
    </div>
  )
}

interface SortableBoardRowProps {
  item: Widget
  now: Date
  activeId: string | null
  isMenuOpen: boolean
  hasActions: boolean
  draggable: boolean
  prefersReducedMotion: boolean
  onCloseMenu: () => void
  onOpenMenu: (id: string, x: number, y: number) => void
  onWidgetChange?: (widget: Widget) => void
}

const SortableBoardRow = ({
  item,
  now,
  activeId,
  isMenuOpen,
  hasActions,
  draggable,
  prefersReducedMotion,
  onCloseMenu,
  onOpenMenu,
  onWidgetChange
}: SortableBoardRowProps) => {
  const {
    listeners,
    isDragging,
    isOver,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: item.id,
    disabled: !draggable
  })

  const className = [
    "board-row--sortable",
    draggable ? "board-row--draggable" : "",
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

    // Let a note's textarea (etc.) keep its native copy/paste menu.
    if (isFromInteractiveControl(event)) {
      return
    }

    event.preventDefault()
    onOpenMenu(item.id, event.clientX, event.clientY)
  }

  // Keyboard dragging is only offered when the card is draggable; otherwise the
  // sortable's key listener is skipped so arrow keys do nothing surprising.
  const deferToDragKeys = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (draggable) {
      listeners?.onKeyDown?.(event)
    }
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    // Keys typed into an interactive control (a note's textarea, a button) stay
    // with that control — never start a drag or open the menu — except Escape,
    // which still closes an open menu.
    if (isFromInteractiveControl(event) && event.key !== "Escape") {
      return
    }

    if (!hasActions) {
      deferToDragKeys(event)
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

    deferToDragKeys(event)
  }

  // Only the pointer activator moves to the frame so dragging starts from the
  // border; keyboard dragging stays on the focusable card via handleKeyDown,
  // which still defers to the sortable's onKeyDown listener. dnd-kit types its
  // listeners loosely as `Function`, so narrow the pointer-down handler here.
  // When dragging is turned off there is no frame at all, leaving the whole
  // card selectable.
  const onPointerDown = listeners?.onPointerDown as
    | PointerEventHandler<HTMLDivElement>
    | undefined

  return (
    <BoardRow
      articleProps={{
        "aria-haspopup": hasActions ? "menu" : undefined,
        onContextMenu: handleContextMenu,
        onKeyDown: handleKeyDown,
        tabIndex: 0
      }}
      dragHandleProps={draggable ? { onPointerDown } : undefined}
      className={className}
      item={item}
      now={now}
      onWidgetChange={onWidgetChange}
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
  draggable = true,
  columns = "auto",
  renderItemActions,
  onReorder,
  onWidgetChange,
  onArchive
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

    if (over.id === ARCHIVE_DROP_ID) {
      onArchive?.(String(active.id))
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

  const sectionClassName = [
    "board-list",
    activeId ? "board-list--dragging" : ""
  ]
    .filter(Boolean)
    .join(" ")

  // A fixed column count is driven by a CSS variable; `auto` keeps the
  // responsive grid that fits as many cards as the width allows.
  const sectionStyle =
    columns === "auto"
      ? undefined
      : ({ "--board-columns": String(columns) } as CSSProperties)

  return (
    <>
      <DndContext
        collisionDetection={closestCenter}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}>
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          <section
            className={sectionClassName}
            data-columns={columns === "auto" ? undefined : columns}
            style={sectionStyle}
            aria-label="Clockboard widgets">
            {items.map((item) => (
              <SortableBoardRow
                activeId={activeId}
                draggable={draggable}
                hasActions={hasActions}
                isMenuOpen={openMenu?.id === item.id}
                item={item}
                key={item.id}
                now={now}
                onCloseMenu={closeMenu}
                onOpenMenu={handleOpenMenu}
                onWidgetChange={onWidgetChange}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </section>
        </SortableContext>
        {activeId && onArchive ? <ArchiveDropZone /> : null}
      </DndContext>
      {openMenu && activeMenuItem && renderItemActions ? (
        <WidgetContextMenu
          label={`Actions for ${activeMenuItem.title}`}
          onClose={closeMenu}
          x={openMenu.x}
          y={openMenu.y}>
          {renderItemActions(activeMenuItem, activeMenuIndex)}
        </WidgetContextMenu>
      ) : null}
    </>
  )
}
