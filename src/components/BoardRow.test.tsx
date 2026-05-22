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
      placement: "main",
      colorPreset: "rose",
      settings: {
        timeZone: "UTC"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
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

  it("renders card actions when provided", () => {
    const item: Widget = {
      id: "local",
      kind: "clock",
      title: "Local time",
      placement: "main",
      colorPreset: "slate",
      settings: {
        timeZone: "UTC"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }

    render(
      <BoardRow
        actions={<button type="button">Edit</button>}
        item={item}
        now={new Date("2026-01-01T12:30:00.000Z")}
      />
    )

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
  })

  it("renders a due countdown without time-zone text", () => {
    const item: Widget = {
      id: "deadline",
      kind: "countdown",
      title: "Deadline",
      placement: "main",
      colorPreset: "amber",
      settings: {
        targetAt: "2026-01-01T12:30:00.000Z"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
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
