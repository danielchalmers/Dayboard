import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BoardRow } from "./BoardRow"
import type { Widget } from "~/lib/types"

describe("BoardRow", () => {
  it("renders a clock row with its time-zone detail", () => {
    const item: Widget = {
      id: "utc",
      kind: "clock",
      title: "UTC",
      placement: "main",
      settings: {
        timeZone: "UTC"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }

    render(<BoardRow item={item} now={new Date("2026-01-01T12:30:00.000Z")} />)

    expect(screen.getByRole("heading", { name: "UTC" })).toBeInTheDocument()
    expect(screen.getByLabelText("UTC time")).toHaveTextContent(/12:30/)
    expect(screen.getByText((content, element) =>
      element?.className === "board-row__detail" && content.includes("UTC")
    )).toBeInTheDocument()
    expect(screen.getByText(/Thu, Jan 1, 2026/)).toBeInTheDocument()
  })

  it("renders row actions when provided", () => {
    const item: Widget = {
      id: "local",
      kind: "clock",
      title: "Local time",
      placement: "main",
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
      settings: {
        targetAt: "2026-01-01T12:30:00.000Z"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }

    render(<BoardRow item={item} now={new Date("2026-01-01T12:30:01.000Z")} />)

    expect(screen.getByRole("heading", { name: "Deadline" })).toBeInTheDocument()
    expect(screen.getByText("right now")).toBeInTheDocument()
    expect(screen.queryByText(/UTC|GMT/)).not.toBeInTheDocument()
  })
})
