// @vitest-environment jsdom

import { act, createEvent, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { BoardList } from "./BoardList"
import { toDayKey } from "~/lib/habit"
import type { Widget } from "~/lib/types"

const widgets: Widget[] = [
  {
    id: "local",
    kind: "clock",
    title: "Local time",
    colorPreset: "slate",
    settings: {
      timeZone: "UTC"
    }
  },
  {
    id: "launch",
    kind: "countdown",
    title: "Launch",
    colorPreset: "rose",
    settings: {
      targetAt: "2026-01-02T09:00:00.000Z"
    }
  }
]

const renderActions = (item: Widget) => (
  <>
    <button aria-label={`Move ${item.title} back`} role="menuitem" type="button">
      Move back
    </button>
    <button aria-label={`Edit ${item.title}`} role="menuitem" type="button">
      Edit
    </button>
  </>
)

const renderBoard = () =>
  render(
    <BoardList items={widgets} renderItemActions={renderActions} />
  )

const openMenu = (
  container: HTMLElement,
  coordinates: { clientX: number; clientY: number }
) => {
  const card = container.querySelector(".board-row--draggable") as HTMLElement
  card.focus()
  fireEvent.contextMenu(card, coordinates)
  return card
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      addEventListener: () => {},
      matches: false,
      removeEventListener: () => {}
    })
  })
})

// A new tab can sit open overnight.
// These rows never see the minute tick, so the only thing that can bring them a fresh `now` is the shared clock waking them at local midnight.
describe("a board left open across local midnight", () => {
  const lateMonday = new Date(2026, 2, 2, 23, 59, 0)
  const earlyTuesday = new Date(2026, 2, 3, 0, 1, 0)

  const habit: Widget = {
    id: "walk",
    kind: "habit",
    title: "Daily walk",
    colorPreset: "amber",
    settings: { history: [] }
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  // Render at 23:59, then let the clock's own timeout carry the page past midnight, the way a sleeping laptop would.
  const crossMidnight = (ui: React.ReactElement) => {
    vi.useFakeTimers()
    vi.setSystemTime(lateMonday)

    const rendered = render(ui)

    act(() => {
      vi.setSystemTime(earlyTuesday)
      vi.advanceTimersByTime(2 * 60_000)
    })

    return rendered
  }

  it("marks the new day, not the day the tab was opened on", () => {
    const onWidgetChange = vi.fn()
    crossMidnight(<BoardList items={[habit]} onWidgetChange={onWidgetChange} />)

    fireEvent.click(screen.getByRole("button", { name: "Mark today" }))

    expect(onWidgetChange).toHaveBeenCalledWith({
      ...habit,
      settings: { history: [toDayKey(earlyTuesday)] }
    })
  })

  it("reopens yesterday's completed habit for the new day", () => {
    const done: Widget = {
      ...habit,
      settings: { history: [toDayKey(lateMonday)] }
    }

    vi.useFakeTimers()
    vi.setSystemTime(lateMonday)
    const { container } = render(<BoardList items={[done]} />)
    expect(screen.getByRole("button", { name: "Done today ✓" })).toBeInTheDocument()

    act(() => {
      vi.setSystemTime(earlyTuesday)
      vi.advanceTimersByTime(2 * 60_000)
    })

    // Yesterday's dot stays lit, but today is unmarked again.
    expect(screen.getByRole("button", { name: "Mark today" })).toBeInTheDocument()
    expect(container.querySelectorAll(".habit-day--done")).toHaveLength(1)
  })

  it("rotates a daily quote onto the new day", () => {
    const quote: Widget = {
      id: "quote",
      kind: "quote",
      title: "Quote",
      colorPreset: "sky",
      settings: { quotes: ["First", "Second"], rotation: "daily" }
    }

    vi.useFakeTimers()
    vi.setSystemTime(lateMonday)
    const { container } = render(<BoardList items={[quote]} />)
    const monday = container.querySelector(".quote-text")?.textContent

    act(() => {
      vi.setSystemTime(earlyTuesday)
      vi.advanceTimersByTime(2 * 60_000)
    })

    expect(container.querySelector(".quote-text")?.textContent).not.toBe(monday)
  })
})

describe("BoardList", () => {
  it("shows a kind-agnostic empty state when there are no widgets", () => {
    render(<BoardList items={[]} />)

    expect(
      screen.getByRole("heading", { name: "A fresh start" })
    ).toBeInTheDocument()
    expect(screen.getByText(/add a clock, a countdown, a note/i)).toBeInTheDocument()
  })

  // Deleting the last card, or archiving it, empties the board while the component stays mounted.
  // Every hook has to run on that render too: one declared past the empty-state return is a hook fewer than the render before it, and React throws instead of showing the empty state.
  it("swaps to the empty state when the last card goes", () => {
    const { rerender } = render(
      <BoardList items={widgets} renderItemActions={renderActions} />
    )

    expect(() =>
      rerender(
        <BoardList items={[]} renderItemActions={renderActions} />
      )
    ).not.toThrow()

    expect(
      screen.getByRole("heading", { name: "A fresh start" })
    ).toBeInTheDocument()
  })

  it("makes each widget card draggable by its frame", () => {
    const { container } = render(<BoardList items={widgets} />)

    const frames = container.querySelectorAll(".board-row__frame")
    const cards = new Set(
      [...frames].map((frame) => frame.closest(".board-row--draggable"))
    )

    expect(frames).toHaveLength(2)
    // One draggable card per frame, so neither card is left without a handle of its own.
    expect(cards.has(null)).toBe(false)
    expect(cards.size).toBe(2)
  })

  it("opens a free-form popover menu under the cursor on right click", () => {
    const { container } = renderBoard()

    expect(screen.queryByLabelText("Actions for Local time")).not.toBeInTheDocument()
    expect(container.querySelector(".card-menu__panel")).not.toBeInTheDocument()

    const card = openMenu(container, { clientX: 320, clientY: 240 })

    const panel = screen.getByLabelText("Actions for Local time")
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveAttribute("role", "menu")
    expect(screen.getByLabelText("Edit Local time")).toBeInTheDocument()

    const menu = panel.closest(".card-menu") as HTMLElement
    // It is a native popover rendered outside the card so it can break free of it.
    expect(menu).toHaveAttribute("popover", "auto")
    expect(card.contains(menu)).toBe(false)

    // It spawns under the cursor rather than in a fixed corner of the card.
    expect(menu.style.left).toBe("320px")
    expect(menu.style.top).toBe("240px")
  })

  it("clamps the menu back inside the viewport when the cursor is near an edge", () => {
    const { container } = renderBoard()

    openMenu(container, { clientX: -50, clientY: -50 })

    const menu = screen
      .getByLabelText("Actions for Local time")
      .closest(".card-menu") as HTMLElement

    // Negative cursor coordinates are clamped back to the viewport margin.
    expect(menu.style.left).toBe("8px")
    expect(menu.style.top).toBe("8px")
  })

  it("clamps the menu so its real size stays on screen near the right and bottom edges", () => {
    const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")
    const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")
    const innerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth")
    const innerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight")

    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 300 })
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 200 })
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 })
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 })

    try {
      const { container } = renderBoard()

      openMenu(container, { clientX: 480, clientY: 380 })

      const menu = screen
        .getByLabelText("Actions for Local time")
        .closest(".card-menu") as HTMLElement

      // Clamped to innerWidth/Height − menu size − 8px margin, measured at full size.
      expect(menu.style.left).toBe("192px")
      expect(menu.style.top).toBe("192px")
    } finally {
      if (offsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsetWidth)
      if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight)
      if (innerWidth) Object.defineProperty(window, "innerWidth", innerWidth)
      if (innerHeight) Object.defineProperty(window, "innerHeight", innerHeight)
    }
  })

  it("moves focus between items with the arrow keys, Home, and End", () => {
    const { container } = renderBoard()

    openMenu(container, { clientX: 10, clientY: 10 })

    const moveUp = screen.getByLabelText("Move Local time back")
    const edit = screen.getByLabelText("Edit Local time")
    const panel = screen.getByLabelText("Actions for Local time")

    // Opening the menu moves focus into it: it sits outside the card's tab order.
    expect(document.activeElement).toBe(moveUp)

    fireEvent.keyDown(panel, { key: "ArrowDown" })
    expect(document.activeElement).toBe(edit)

    fireEvent.keyDown(panel, { key: "ArrowDown" })
    expect(document.activeElement).toBe(moveUp) // wraps to the first item

    fireEvent.keyDown(panel, { key: "ArrowUp" })
    expect(document.activeElement).toBe(edit) // wraps to the last item

    fireEvent.keyDown(panel, { key: "Home" })
    expect(document.activeElement).toBe(moveUp)

    fireEvent.keyDown(panel, { key: "End" })
    expect(document.activeElement).toBe(edit)
  })

  // The panel is a popover parked outside the card, so a Tab the browser handled would drop focus somewhere unrelated to the card that was right-clicked, with the menu still open behind it.
  it("keeps Tab and Shift+Tab cycling inside the menu", () => {
    const { container } = renderBoard()

    openMenu(container, { clientX: 10, clientY: 10 })

    const moveUp = screen.getByLabelText("Move Local time back")
    const edit = screen.getByLabelText("Edit Local time")
    const panel = screen.getByLabelText("Actions for Local time")

    const tab = (shiftKey = false) => {
      const event = createEvent.keyDown(panel, { key: "Tab", shiftKey })
      fireEvent(panel, event)
      return event
    }

    // The default move is suppressed, not merely raced with the menu's own.
    expect(tab().defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(edit)

    tab()
    expect(document.activeElement).toBe(moveUp)

    tab(true)
    expect(document.activeElement).toBe(edit)
  })

  it("leaves the native menu alone when text on the card is selected", () => {
    const { container } = renderBoard()

    const card = container.querySelector(".board-row--draggable") as HTMLElement
    const title = card.querySelector(".board-row__title") as HTMLElement
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(title)
    selection.removeAllRanges()
    selection.addRange(range)

    const event = createEvent.contextMenu(card, { clientX: 10, clientY: 10 })
    fireEvent(card, event)

    expect(event.defaultPrevented).toBe(false)
    expect(screen.queryByLabelText("Actions for Local time")).not.toBeInTheDocument()
  })

  // Triple-clicking a line is the most ordinary way to select one, and Chrome runs the resulting range past the end of the block it started in, so the range's common ancestor lands outside the card entirely.
  it("leaves the native menu alone when the selection runs past the card", () => {
    const { container } = renderBoard()

    const cards = container.querySelectorAll<HTMLElement>(".board-row--draggable")
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(cards[0]!.querySelector(".board-row__title")!, 0)
    range.setEnd(cards[1]!.querySelector(".board-row__title")!, 0)
    selection.removeAllRanges()
    selection.addRange(range)

    const event = createEvent.contextMenu(cards[0]!, { clientX: 10, clientY: 10 })
    fireEvent(cards[0]!, event)

    expect(event.defaultPrevented).toBe(false)
    expect(screen.queryByLabelText("Actions for Local time")).not.toBeInTheDocument()
  })

  it("still opens its own menu when the selection sits on another card", () => {
    const { container } = renderBoard()

    const cards = container.querySelectorAll<HTMLElement>(".board-row--draggable")
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(cards[1]!.querySelector(".board-row__title")!)
    selection.removeAllRanges()
    selection.addRange(range)

    fireEvent.contextMenu(cards[0]!, { clientX: 10, clientY: 10 })

    expect(screen.getByLabelText("Actions for Local time")).toBeInTheDocument()
  })

  it("closes the menu when an item is chosen", () => {
    const { container } = renderBoard()

    openMenu(container, { clientX: 10, clientY: 10 })
    fireEvent.click(screen.getByLabelText("Edit Local time"))

    expect(screen.queryByLabelText("Actions for Local time")).not.toBeInTheDocument()
  })
})
