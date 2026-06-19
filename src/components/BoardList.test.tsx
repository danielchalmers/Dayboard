import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { BoardList } from "./BoardList"
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
    <button aria-label={`Move ${item.title} up`} role="menuitem" type="button">
      Move up
    </button>
    <button aria-label={`Edit ${item.title}`} role="menuitem" type="button">
      Edit
    </button>
  </>
)

const renderBoard = () =>
  render(
    <BoardList
      items={widgets}
      now={new Date("2026-01-01T12:30:00.000Z")}
      renderItemActions={renderActions}
    />
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

describe("BoardList", () => {
  it("makes each widget card draggable", () => {
    const { container } = render(<BoardList items={widgets} now={new Date("2026-01-01T12:30:00.000Z")} />)

    expect(container.querySelectorAll(".board-row--draggable")).toHaveLength(2)
  })

  it("exposes a drag-handle frame inside each draggable card", () => {
    const { container } = render(<BoardList items={widgets} now={new Date("2026-01-01T12:30:00.000Z")} />)

    const frames = container.querySelectorAll(".board-row__frame")

    expect(frames).toHaveLength(2)
    frames.forEach((frame) => {
      expect(frame.closest(".board-row--draggable")).not.toBeNull()
    })
  })

  it("removes the drag-handle frame when dragging is disabled", () => {
    const { container } = render(
      <BoardList
        items={widgets}
        now={new Date("2026-01-01T12:30:00.000Z")}
        draggable={false}
      />
    )

    expect(container.querySelectorAll(".board-row__frame")).toHaveLength(0)
    expect(container.querySelectorAll(".board-row--draggable")).toHaveLength(0)
  })

  it("applies a fixed column count to the board grid", () => {
    const { container } = render(
      <BoardList
        items={widgets}
        now={new Date("2026-01-01T12:30:00.000Z")}
        columns={3}
      />
    )

    const board = container.querySelector(".board-list") as HTMLElement
    expect(board).toHaveAttribute("data-columns", "3")
    expect(board.style.getPropertyValue("--board-columns")).toBe("3")
  })

  it("leaves the responsive grid in place for the auto column setting", () => {
    const { container } = render(
      <BoardList
        items={widgets}
        now={new Date("2026-01-01T12:30:00.000Z")}
        columns="auto"
      />
    )

    const board = container.querySelector(".board-list") as HTMLElement
    expect(board).not.toHaveAttribute("data-columns")
    expect(board.style.getPropertyValue("--board-columns")).toBe("")
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

  it("moves focus into the menu so keyboard users can reach it", () => {
    const { container } = renderBoard()

    openMenu(container, { clientX: 10, clientY: 10 })

    expect(document.activeElement).toBe(screen.getByLabelText("Move Local time up"))
  })

  it("moves focus between items with the arrow keys, Home, and End", () => {
    const { container } = renderBoard()

    openMenu(container, { clientX: 10, clientY: 10 })

    const moveUp = screen.getByLabelText("Move Local time up")
    const edit = screen.getByLabelText("Edit Local time")
    const panel = screen.getByLabelText("Actions for Local time")

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

  it("closes the menu when an item is chosen", () => {
    const { container } = renderBoard()

    openMenu(container, { clientX: 10, clientY: 10 })
    fireEvent.click(screen.getByLabelText("Edit Local time"))

    expect(screen.queryByLabelText("Actions for Local time")).not.toBeInTheDocument()
  })
})
