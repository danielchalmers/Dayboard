import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BoardRow } from "./BoardRow"
import { toDayKey } from "~/lib/habit"
import { dailyQuoteIndex } from "~/lib/quotes"
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

  it("renders a countdown as a progress bar when configured", () => {
    const item: Widget = {
      id: "year",
      kind: "countdown",
      title: "Year",
      colorPreset: "sky",
      settings: {
        display: "progress",
        startAt: "2026-01-01T00:00:00.000Z",
        targetAt: "2026-01-11T00:00:00.000Z"
      }
    }

    render(<BoardRow item={item} now={new Date("2026-01-06T00:00:00.000Z")} />)

    expect(screen.getByText("50%")).toBeInTheDocument()
    const bar = screen.getByRole("progressbar", { name: "Year progress" })
    expect(bar).toHaveAttribute("aria-valuenow", "50")
    expect(bar.querySelector(".progress-bar__fill")).toHaveStyle({
      inlineSize: "50%"
    })
  })

  it("marks today on a habit and reports the streak", () => {
    const now = new Date("2026-03-04T09:00:00.000Z")
    const item: Widget = {
      id: "habit",
      kind: "habit",
      title: "Read",
      colorPreset: "emerald",
      settings: { history: [] }
    }
    const onWidgetChange = vi.fn()

    render(<BoardRow item={item} now={now} onWidgetChange={onWidgetChange} />)

    expect(screen.getByLabelText("0 day streak")).toBeInTheDocument()
    const button = screen.getByRole("button", { name: "Mark today" })
    expect(button).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(button)

    expect(onWidgetChange).toHaveBeenCalledWith({
      ...item,
      settings: { history: [toDayKey(now)] }
    })
  })

  it("shows a completed habit as done with its streak", () => {
    const now = new Date("2026-03-04T09:00:00.000Z")
    const item: Widget = {
      id: "habit",
      kind: "habit",
      title: "Read",
      colorPreset: "emerald",
      settings: { history: [toDayKey(now)] }
    }

    render(<BoardRow item={item} now={now} />)

    expect(screen.getByLabelText("1 day streak")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Done today ✓" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("renders a note card with an editable text area", () => {
    const item: Widget = {
      id: "scratch",
      kind: "note",
      title: "Scratchpad",
      colorPreset: "violet",
      settings: { text: "Call the dentist" }
    }

    render(<BoardRow item={item} now={new Date("2026-01-01T12:30:00.000Z")} />)

    expect(screen.getByRole("heading", { name: "Scratchpad" })).toBeInTheDocument()
    expect(screen.getByLabelText("Scratchpad note")).toHaveValue(
      "Call the dentist"
    )
  })

  it("saves note edits on blur", () => {
    const item: Widget = {
      id: "scratch",
      kind: "note",
      title: "Scratchpad",
      colorPreset: "slate",
      settings: { text: "" }
    }
    const onWidgetChange = vi.fn()

    render(
      <BoardRow
        item={item}
        now={new Date("2026-01-01T12:30:00.000Z")}
        onWidgetChange={onWidgetChange}
      />
    )

    const field = screen.getByLabelText("Scratchpad note")
    fireEvent.change(field, { target: { value: "Buy milk" } })
    fireEvent.blur(field)

    expect(onWidgetChange).toHaveBeenCalledWith({
      ...item,
      settings: { text: "Buy milk" }
    })
  })

  it("renders the deterministic daily quote for a quote widget", () => {
    const quotes = ["Quote A", "Quote B", "Quote C"]
    const now = new Date("2026-03-04T09:00:00.000Z")
    const item: Widget = {
      id: "q",
      kind: "quote",
      title: "Daily quote",
      colorPreset: "sky",
      settings: { quotes, rotation: "daily" }
    }

    render(<BoardRow item={item} now={now} />)

    expect(screen.getByRole("heading", { name: "Daily quote" })).toBeInTheDocument()
    expect(
      screen.getByText(quotes[dailyQuoteIndex(now, quotes.length)]!)
    ).toBeInTheDocument()
  })

  it("prompts to add quotes when the list is empty", () => {
    const item: Widget = {
      id: "q",
      kind: "quote",
      title: "Daily quote",
      colorPreset: "slate",
      settings: { quotes: [], rotation: "daily" }
    }

    render(<BoardRow item={item} now={new Date("2026-03-04T09:00:00.000Z")} />)

    expect(screen.getByText(/Add a few quotes/)).toBeInTheDocument()
  })

  it("shows a quote from the list in open rotation", () => {
    const quotes = ["Only one here"]
    const item: Widget = {
      id: "q",
      kind: "quote",
      title: "Shuffle",
      colorPreset: "slate",
      settings: { quotes, rotation: "open" }
    }

    render(<BoardRow item={item} now={new Date("2026-03-04T09:00:00.000Z")} />)

    expect(screen.getByText("Only one here")).toBeInTheDocument()
  })

  it("renders a stopwatch and starts it from the button", () => {
    const item: Widget = {
      id: "sw",
      kind: "stopwatch",
      title: "Focus",
      colorPreset: "slate",
      settings: { running: false, elapsedMs: 0, startedAt: null }
    }
    const onWidgetChange = vi.fn()

    render(
      <BoardRow
        item={item}
        now={new Date("2026-01-01T12:30:00.000Z")}
        onWidgetChange={onWidgetChange}
      />
    )

    expect(screen.getByText("0:00")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    expect(onWidgetChange).toHaveBeenCalledTimes(1)
    expect(onWidgetChange.mock.calls[0]![0].settings.running).toBe(true)
  })

  it("shows live stopwatch time while running", () => {
    const item: Widget = {
      id: "sw",
      kind: "stopwatch",
      title: "Focus",
      colorPreset: "slate",
      settings: { running: true, elapsedMs: 0, startedAt: 1000 }
    }

    render(<BoardRow item={item} now={new Date(1000 + 65_000)} />)

    expect(screen.getByText("1:05")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("renders a timer's remaining time and resumes from the button", () => {
    const item: Widget = {
      id: "t",
      kind: "timer",
      title: "Tea",
      colorPreset: "emerald",
      settings: {
        durationMs: 300_000,
        running: false,
        remainingMs: 120_000,
        endsAt: null
      }
    }
    const onWidgetChange = vi.fn()

    render(
      <BoardRow
        item={item}
        now={new Date("2026-01-01T12:30:00.000Z")}
        onWidgetChange={onWidgetChange}
      />
    )

    expect(screen.getByText("2:00")).toBeInTheDocument()
    // Mid-way and paused → the primary control offers to resume.
    fireEvent.click(screen.getByRole("button", { name: "Resume" }))
    expect(onWidgetChange.mock.calls[0]![0].settings.running).toBe(true)
  })

  it("announces completion to screen readers when a timer is done", () => {
    const item: Widget = {
      id: "t",
      kind: "timer",
      title: "Tea",
      colorPreset: "emerald",
      settings: { durationMs: 60_000, running: false, remainingMs: 0, endsAt: null }
    }

    render(<BoardRow item={item} now={new Date(50_000)} />)

    expect(screen.getByRole("status")).toHaveTextContent("Tea timer finished")
  })

  it("keeps the live region empty while a timer is still running", () => {
    const item: Widget = {
      id: "t",
      kind: "timer",
      title: "Tea",
      colorPreset: "emerald",
      settings: { durationMs: 60_000, running: true, remainingMs: 60_000, endsAt: 60_000 }
    }

    render(<BoardRow item={item} now={new Date(0)} />)

    expect(screen.getByRole("status").textContent).toBe("")
  })

  it("settles a running timer once it reaches zero", () => {
    const item: Widget = {
      id: "t",
      kind: "timer",
      title: "Tea",
      colorPreset: "emerald",
      settings: {
        durationMs: 60_000,
        running: true,
        remainingMs: 60_000,
        endsAt: 1000
      }
    }
    const onWidgetChange = vi.fn()

    // now is well past endsAt, so the timer is done.
    render(
      <BoardRow item={item} now={new Date(50_000)} onWidgetChange={onWidgetChange} />
    )

    expect(onWidgetChange).toHaveBeenCalledWith({
      ...item,
      settings: { ...item.settings, running: false, remainingMs: 0, endsAt: null }
    })
  })

  describe("with fake timers", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("auto-saves a note a short beat after typing stops", () => {
      vi.useFakeTimers()

      const item: Widget = {
        id: "scratch",
        kind: "note",
        title: "Scratchpad",
        colorPreset: "slate",
        settings: { text: "" }
      }
      const onWidgetChange = vi.fn()

      render(
        <BoardRow
          item={item}
          now={new Date("2026-01-01T12:30:00.000Z")}
          onWidgetChange={onWidgetChange}
        />
      )

      fireEvent.change(screen.getByLabelText("Scratchpad note"), {
        target: { value: "Idea" }
      })

      expect(onWidgetChange).not.toHaveBeenCalled()

      vi.advanceTimersByTime(600)

      expect(onWidgetChange).toHaveBeenCalledWith({
        ...item,
        settings: { text: "Idea" }
      })
    })
  })
})
