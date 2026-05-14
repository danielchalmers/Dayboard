import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BoardRow } from "./BoardRow"
import type { BoardItem, ClockboardSettings } from "~/lib/types"

const settings: ClockboardSettings = {
  boardTitle: "Clockboard",
  showDate: true
}

describe("BoardRow", () => {
  it("renders a clock row with its title and time zone", () => {
    const item: BoardItem = {
      id: "utc",
      kind: "clock",
      title: "UTC",
      timeZone: "UTC",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }

    render(
      <BoardRow
        item={item}
        now={new Date("2026-01-01T12:30:00.000Z")}
        settings={settings}
      />
    )

    expect(screen.getByRole("heading", { name: "UTC" })).toBeInTheDocument()
    expect(screen.getByText("Clock")).toBeInTheDocument()
    expect(screen.getByLabelText("UTC time")).toHaveTextContent(/12:30/)
  })

  it("renders a due countdown in plain language", () => {
    const item: BoardItem = {
      id: "deadline",
      kind: "countdown",
      title: "Deadline",
      timeZone: "UTC",
      targetDateTime: "2026-01-01T12:30",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }

    render(
      <BoardRow
        item={item}
        now={new Date("2026-01-01T12:30:01.000Z")}
        settings={settings}
      />
    )

    expect(screen.getByRole("heading", { name: "Deadline" })).toBeInTheDocument()
    expect(screen.getByText("right now")).toBeInTheDocument()
  })
})
