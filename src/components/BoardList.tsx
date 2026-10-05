import { useDndContext, useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEventHandler,
  type ReactNode
} from "react"

import { BOARD_DROP_ID } from "~/components/BoardDnd"
import {
  BoardRow,
  BoardRowFallback,
  type TimerFinishHandler,
  type WidgetChangeHandler
} from "~/components/BoardRow"
import { CardBoundary } from "~/components/CardBoundary"
import { useNow } from "~/hooks/useNow"
import { widgetClockGranularity } from "~/lib/clock"
import type { Widget } from "~/lib/types"

interface BoardListProps {
  items: Widget[]
  // Marks this list as the place archived cards land when dragged back: the grid highlights while a foreign card is in flight, and the empty state becomes a drop target of its own.
  restoreTarget?: boolean
  // Something sits in the archive, so an empty board has been tidied away rather than never filled.
  hasArchived?: boolean
  renderItemActions?: (item: Widget, index: number) => ReactNode
  onWidgetChange?: WidgetChangeHandler
  onTimerFinish?: TimerFinishHandler
}

// With no cards on the board there is no slot to aim an archived card at, so the empty-state placeholder itself doubles as the restore target while a drag is under way.
const EmptyState = ({
  restoreTarget,
  hasArchived
}: {
  restoreTarget: boolean
  hasArchived: boolean
}) => {
  const { active } = useDndContext()
  const { setNodeRef, isOver } = useDroppable({
    id: BOARD_DROP_ID,
    disabled: !restoreTarget
  })

  const isRestoreReady = restoreTarget && Boolean(active)

  const className = [
    "empty-state",
    isRestoreReady ? "empty-state--restore" : "",
    isRestoreReady && isOver ? "empty-state--over" : ""
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={className} ref={restoreTarget ? setNodeRef : undefined}>
      {isRestoreReady ? (
        <>
          <h2>{isOver ? "Release to restore" : "Drop it here to restore"}</h2>
          <p>The card leaves the archive and comes back onto the board.</p>
        </>
      ) : hasArchived ? (
        // Archiving every card is a tidy-up, not a first run, so point at where the cards went before pointing at +.
        // A no-break space keeps the + with its "button", since a line that ends on a lone + reads as a stray symbol.
        <>
          <span aria-hidden="true" className="empty-state__glyph">✦</span>
          <h2>All tucked away</h2>
          <p>
            Your archived cards are just below. The +&nbsp;button up top adds
            something new.
          </p>
        </>
      ) : (
        <>
          <span aria-hidden="true" className="empty-state__glyph">✦</span>
          <h2>A fresh start</h2>
          <p>
            Add a clock, a countdown, a note — whatever your day needs. The +
            button up top has them all.
          </p>
        </>
      )}
    </div>
  )
}

// Interactive widgets (a note's textarea, a timer's buttons) own their key and right-click behavior, so the card must not hijack those events for dragging or its context menu when they originate inside such a control.
const FORM_FIELD_SELECTOR =
  "input, textarea, select, button, [contenteditable='true']"

const isFromInteractiveControl = (event: { target: EventTarget | null }) =>
  Boolean((event.target as HTMLElement | null)?.closest(FORM_FIELD_SELECTOR))

// Right-clicking a stretch of selected text is a reach for Copy, not for the card's own menu, so the card steps aside and lets the browser's menu through.
// Only a selection touching this card counts; a leftover highlight elsewhere on the page should not disarm the menu here.
//
// The test is whether the range overlaps the card, not where its common ancestor sits: triple-clicking a quote selects the whole block and Chrome runs the range on to the start of the next one, which lifts the common ancestor clear out of the card and made that check miss the most ordinary way of selecting a line.
export const hasSelectionWithin = (card: HTMLElement): boolean => {
  const selection = card.ownerDocument.defaultView?.getSelection()

  if (!selection || selection.isCollapsed) {
    return false
  }

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)

    if (!range.collapsed && range.intersectsNode(card)) {
      return true
    }
  }

  return false
}

// Focus is looked after only when an action came from the keyboard or assistive tech.
// A pointer user has no place on the board to keep, and a card left focused without a ring would take their next Space as the start of a drag.
// A click made by a key or a screen reader carries no click count, and a focus the keyboard placed matches :focus-visible.
export const isKeyboardAction = (event?: { detail: number }) =>
  event?.detail === 0 ||
  Boolean(document.activeElement?.matches(":focus-visible"))

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

// A free-form context menu that spawns under the cursor.
// It uses the native Popover API so it renders in the top layer, escaping the card's clipped, overflow-hidden bounds, and gets light-dismiss + Escape handling for free.
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

  // Promote the menu to the top layer, move focus into it (it sits outside the card's tab order), and mirror native dismissals (Escape / click-away) into React.
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
      // Already shown, so ignore.
    }

    // Focus without scrolling: a menu opened near the bottom of a scrollable page would otherwise scroll the focused item into view, and that scroll trips the close-on-scroll handler below, dismissing the menu instantly.
    getMenuItems(panel)[0]?.focus({ preventScroll: true })

    const handleToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === "closed") {
        onCloseRef.current()
      }
    }

    menu.addEventListener("toggle", handleToggle)

    return () => menu.removeEventListener("toggle", handleToggle)
  }, [])

  // Keep the menu on screen, measuring the settled layout box (offsetWidth/Height ignore the scale-up transform so we clamp against the real size).
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

  // A viewport-fixed menu drifts away from its card on scroll or resize, so close it.
  // Hide it through the Popover API (not a bare React unmount) so the browser runs its native focus-restoration and returns focus to the opener; the resulting toggle event then clears the React state.
  useEffect(() => {
    const close = () => {
      const menu = menuRef.current

      if (menu) {
        menu.hidePopover()
      } else {
        onCloseRef.current()
      }
    }

    // Focusing a card below the fold scrolls the page to it, and the browser reports that scroll a frame later.
    // A menu opened in between (Shift+F10 straight after focus, or a screen reader doing both at once) would take that late report for a drift and close on the spot, so a page scroll only counts once the page has moved since the menu opened.
    const openedAt = { x: window.scrollX, y: window.scrollY }

    const closeOnScroll = (event: Event) => {
      if (
        event.target === document &&
        window.scrollX === openedAt.x &&
        window.scrollY === openedAt.y
      ) {
        return
      }

      close()
    }

    window.addEventListener("resize", close)
    window.addEventListener("scroll", closeOnScroll, true)

    return () => {
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", closeOnScroll, true)
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
        onClick={(event) => {
          // Only a chosen item dismisses the menu; clicks on the panel's padding or a separator are inert, like a native menu.
          // An item chosen from the keyboard hides the menu through the Popover API first, which hands focus back to the card as Escape does, so a dialog the item opens finds the card as what opened it and returns focus there when it closes.
          if ((event.target as HTMLElement).closest("button")) {
            if (isKeyboardAction(event)) {
              menuRef.current?.hidePopover()
            }

            onClose()
          }
        }}
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
  isMenuOpen: boolean
  hasActions: boolean
  animateEnter: boolean
  prefersReducedMotion: boolean
  onCloseMenu: () => void
  onOpenMenu: (id: string, x: number, y: number) => void
  onWidgetChange?: WidgetChangeHandler
  onTimerFinish?: TimerFinishHandler
}

// Every prop below is stable across a clock tick, so React's shallow compare is the whole memo: a row renders when its own widget, menu state, or callbacks change, and otherwise only when its own clock subscription fires.
const SortableBoardRow = memo(({
  item,
  isMenuOpen,
  hasActions,
  animateEnter,
  prefersReducedMotion,
  onCloseMenu,
  onOpenMenu,
  onWidgetChange,
  onTimerFinish
}: SortableBoardRowProps) => {
  // Each card keeps its own time at the coarsest step it can show, so a note never wakes for a clock and a clock never wakes for a running stopwatch.
  const now = useNow(widgetClockGranularity(item))
  const {
    listeners,
    isDragging,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: item.id
  })

  const className = [
    "board-row--sortable",
    "board-row--draggable",
    animateEnter ? "board-row--enter" : "",
    isMenuOpen ? "board-row--menu-open" : "",
    isDragging ? "board-row--dragging" : ""
  ]
    .filter(Boolean)
    .join(" ")

  const handleContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (!hasActions) {
      return
    }

    // Let a note's textarea (etc.) keep its native copy/paste menu, and step aside entirely when there is text selected on this card to copy.
    if (
      isFromInteractiveControl(event) ||
      hasSelectionWithin(event.currentTarget)
    ) {
      return
    }

    event.preventDefault()
    // A touch long-press opens the menu without moving focus, and the menu hands focus back to whatever held it when it opened.
    // Taking focus here makes that this card; otherwise a field left focused on another card would get it back, off screen and with the soft keyboard up.
    event.currentTarget.focus({ preventScroll: true })
    onOpenMenu(item.id, event.clientX, event.clientY)
  }

  const deferToDragKeys = (event: ReactKeyboardEvent<HTMLElement>) => {
    listeners?.onKeyDown?.(event)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    // Keys typed into an interactive control (a note's textarea, a button) stay with that control and never start a drag or open the menu, except Escape, which still closes an open menu.
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

  // Only the pointer activator moves to the frame so dragging starts from the border; keyboard dragging stays on the focusable card via handleKeyDown, which still defers to the sortable's onKeyDown listener.
  // dnd-kit types its listeners loosely as `Function`, so narrow the pointer-down handler here.
  const onPointerDown = listeners?.onPointerDown as
    | PointerEventHandler<HTMLDivElement>
    | undefined

  const shared = {
    articleProps: {
      "aria-haspopup": hasActions ? ("menu" as const) : undefined,
      // Lets the page hand focus back to a card by id after the one that had it leaves the board.
      "data-widget-id": item.id,
      onContextMenu: handleContextMenu,
      onKeyDown: handleKeyDown,
      tabIndex: 0
    },
    dragHandleProps: { onPointerDown },
    className,
    item,
    ref: setNodeRef,
    style: {
      // The drag overlay renders the lifted card that follows the cursor, so the in-list item stays in place as a dimmed placeholder.
      // Translating it here is what previously made it snap back to its slot when dragged over the archive zone (a droppable outside the sortable list).
      transform: isDragging ? undefined : CSS.Transform.toString(transform),
      transition: prefersReducedMotion ? undefined : transition
    }
  }

  return (
    <CardBoundary fallback={<BoardRowFallback {...shared} />} item={item}>
      <BoardRow
        {...shared}
        now={now}
        onTimerFinish={onTimerFinish}
        onWidgetChange={onWidgetChange}
      />
    </CardBoundary>
  )
})

export const BoardList = ({
  items,
  restoreTarget = false,
  hasArchived = false,
  renderItemActions,
  onWidgetChange,
  onTimerFinish
}: BoardListProps) => {
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  // The drag context lives in BoardDnd, shared with the other list so cards can cross between the board and the archive mid-drag.
  const { active } = useDndContext()
  const activeId = active ? String(active.id) : null

  // Any open card menu must not linger under a drag (light dismiss only covers pointer drags, not keyboard-initiated ones).
  useEffect(() => {
    if (activeId) {
      setOpenMenu(null)
    }
  }, [activeId])

  // Stable so the memoized rows can skip re-rendering when only the tick changes.
  // Both belong above the empty-state return below: a hook called only when the board has cards is one hook fewer on the render that empties it, which is the "rendered fewer hooks than expected" crash.
  const closeMenu = useCallback(() => setOpenMenu(null), [])
  const handleOpenMenu = useCallback((id: string, x: number, y: number) => {
    document
      .querySelectorAll<HTMLDetailsElement>(".add-menu[open]")
      .forEach((menu) => menu.removeAttribute("open"))
    setOpenMenu({ id, x, y })
  }, [])

  // Cards on the board at first render must not animate in; the page should simply be there on a new tab.
  // Only cards that show up later (added, restored) play the entrance animation.
  const initialIdsRef = useRef<ReadonlySet<string> | null>(null)
  if (initialIdsRef.current === null) {
    initialIdsRef.current = new Set(items.map((item) => item.id))
  }
  const initialIds = initialIdsRef.current

  if (items.length === 0) {
    return <EmptyState hasArchived={hasArchived} restoreTarget={restoreTarget} />
  }

  const itemIds = items.map((item) => item.id)
  const hasActions = Boolean(renderItemActions)

  // A card lifted from the other list: for the board that means an archived card is in flight, and this whole grid is where it can land.
  const isForeignDrag = Boolean(
    activeId && !items.some((item) => item.id === activeId)
  )

  const activeMenuItem = openMenu
    ? items.find((item) => item.id === openMenu.id) ?? null
    : null
  const activeMenuIndex = activeMenuItem ? items.indexOf(activeMenuItem) : -1

  const sectionClassName = [
    "board-list",
    activeId ? "board-list--dragging" : "",
    restoreTarget && isForeignDrag ? "board-list--restore-target" : ""
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <>
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <section className={sectionClassName} aria-label="Dayboard widgets">
          {items.map((item) => (
            <SortableBoardRow
              animateEnter={!initialIds.has(item.id)}
              hasActions={hasActions}
              isMenuOpen={openMenu?.id === item.id}
              item={item}
              key={item.id}
              onCloseMenu={closeMenu}
              onOpenMenu={handleOpenMenu}
              onTimerFinish={onTimerFinish}
              onWidgetChange={onWidgetChange}
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
    </>
  )
}
