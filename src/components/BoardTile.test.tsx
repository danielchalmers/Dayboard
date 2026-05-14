import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BoardTile } from "./BoardTile"
import type { BoardItem, ClockboardSettings } from "~/lib/types"

const settings: ClockboardSettings = {
  boardTitle: "Clockboard",
  density: "comfortable",
  showDate: true
}

describe("BoardTile", () => {
  it("renders a clock tile with its title and time zone", () => {
    const item: BoardItem = {
      id: "utc",
      kind: "clock",
      title: "UTC",
      timeZone: "UTC",
      color: "#0f9f8f",
      format: "24h",
      showSeconds: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }

    render(
      <BoardTile
        item={item}
        now={new Date("2026-01-01T12:30:00.000Z")}
        settings={settings}
      />
    )

    expect(screen.getByRole("heading", { name: "UTC" })).toBeInTheDocument()
    expect(screen.getByText("Clock")).toBeInTheDocument()
    expect(screen.getByText(/12:30/)).toBeInTheDocument()
  })

  it("renders a due countdown as now", () => {
    const item: BoardItem = {
      id: "deadline",
      kind: "countdown",
      title: "Deadline",
      timeZone: "UTC",
      color: "#f2b84b",
      targetDateTime: "2026-01-01T12:30",
      showSeconds: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }

    render(
      <BoardTile
        item={item}
        now={new Date("2026-01-01T12:30:01.000Z")}
        settings={settings}
      />
    )

    expect(screen.getByRole("heading", { name: "Deadline" })).toBeInTheDocument()
    expect(screen.getByText("Now")).toBeInTheDocument()
  })
})
