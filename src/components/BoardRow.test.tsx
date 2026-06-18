import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BoardRow } from "./BoardRow"
import type { Widget } from "~/lib/types"

describe("BoardRow", () => {
  it("renders a clock card with time, date metadata, and color-preset attribute", () => {
    const item: Widget = {
      id: "utc",
      kind: "clock",
      title: "UTC",
      colorPreset: "rose",
      settings: {
        timeZone: "UTC"
      }
    }

    const { container } = render(
      <BoardRow item={item} now={new Date("2026-01-01T12:30:00.000Z")} />
    )

    expect(screen.getByRole("heading", { name: "UTC" })).toBeInTheDocument()
    expect(screen.getByLabelText("UTC time")).toHaveTextContent(/12:30/)
    expect(screen.getByText(/Thu, Jan 1, 2026/).closest(".board-row__meta")).toHaveTextContent("UTC")
    
    // Check that data-color-preset attribute is correctly rendered
    const article = container.querySelector("article")
    expect(article).toHaveAttribute("data-color-preset", "rose")
  })

  it("renders a drag-handle frame only when drag handle props are provided", () => {
    const item: Widget = {
      id: "utc",
      kind: "clock",
      title: "UTC",
      colorPreset: "slate",
      settings: {
        timeZone: "UTC"
      }
    }

    const { container, rerender } = render(
      <BoardRow item={item} now={new Date("2026-01-01T12:30:00.000Z")} />
    )

    expect(container.querySelector(".board-row__frame")).toBeNull()

    rerender(
      <BoardRow
        dragHandleProps={{ id: "drag-handle" }}
        item={item}
        now={new Date("2026-01-01T12:30:00.000Z")}
      />
    )

    const frame = container.querySelector(".board-row__frame")
    expect(frame).toHaveAttribute("id", "drag-handle")
    // The heading is a sibling of the drag frame, not nested inside it, so the
    // body text sits outside the draggable surface and stays selectable.
    expect(frame?.contains(screen.getByRole("heading", { name: "UTC" }))).toBe(
      false
    )
  })

  it("renders a due countdown without time-zone text", () => {
    const item: Widget = {
      id: "deadline",
      kind: "countdown",
      title: "Deadline",
      colorPreset: "amber",
      settings: {
        targetAt: "2026-01-01T12:30:00.000Z"
      }
    }

    const { container } = render(
      <BoardRow item={item} now={new Date("2026-01-01T12:30:01.000Z")} />
    )

    expect(screen.getByRole("heading", { name: "Deadline" })).toBeInTheDocument()
    expect(screen.getByText("right now")).toBeInTheDocument()
    expect(screen.queryByText(/UTC|GMT/)).not.toBeInTheDocument()
    
    const article = container.querySelector("article")
    expect(article).toHaveAttribute("data-color-preset", "amber")
  })
})
