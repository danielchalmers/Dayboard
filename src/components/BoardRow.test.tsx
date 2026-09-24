// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BoardRow, BoardRowFallback } from "./BoardRow"
import { CardBoundary } from "./CardBoundary"
import { playChime, primeChime } from "~/lib/chime"
import { formatDayLabel, toDayKey } from "~/lib/habit"
import { dailyQuoteIndex } from "~/lib/quotes"
import { MAX_TASKS, type TodoTask } from "~/lib/todo"
import type { Widget } from "~/lib/types"

// Sound is the one thing a test cannot observe by rendering, so the chime module is stubbed for the whole file and asserted on by call.
vi.mock("~/lib/chime", () => ({
  playChime: vi.fn(),
  primeChime: vi.fn()
}))

describe("BoardRow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

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

    const article = container.querySelector("article")
    expect(article).toHaveAttribute("data-color-preset", "rose")
  })

  it("renders a clock with no zone as the system clock, and says so", () => {
    const item: Widget = {
      id: "here",
      kind: "clock",
      title: "Here",
      colorPreset: "sky",
      settings: {
        timeZone: ""
      }
    }

    render(<BoardRow item={item} now={new Date("2026-01-01T12:30:00.000Z")} />)

    // The card names the arrangement, not whatever zone the device happens to be in today.
    expect(screen.getByText("System time zone")).toBeInTheDocument()
    // And it does not read as a mistyped zone.
    expect(screen.queryByText(/unrecognized/)).toBeNull()
    expect(screen.getByLabelText("Here time")).not.toBeEmptyDOMElement()
  })

  // The time zone is a free-text field, so a card can be saved with something Intl refuses to build a formatter for.
  // Every clock formatter runs from this render, so an unguarded throw here blanks the whole board over one mistyped zone.
  it("renders a clock card whose time zone is not a real one, saying so", () => {
    const item: Widget = {
      id: "typo",
      kind: "clock",
      title: "Nowhere",
      colorPreset: "teal",
      settings: {
        timeZone: "Not/AZone"
      }
    }

    render(<BoardRow item={item} now={new Date("2026-01-01T12:30:00.000Z")} />)

    expect(screen.getByRole("heading", { name: "Nowhere" })).toBeInTheDocument()
    expect(screen.getByLabelText("Nowhere time")).not.toBeEmptyDOMElement()
    expect(
      screen.getByText(/Not\/AZone — unrecognized, showing your local time/)
    ).toBeInTheDocument()
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
    // The heading is a sibling of the drag frame, not nested inside it, so the body text sits outside the draggable surface and stays selectable.
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
    // "right now" already says everything; a "from now" or "ago" line under it would only contradict itself.
    expect(container.querySelector(".board-row__meta")).toBeNull()


    const article = container.querySelector("article")
    expect(article).toHaveAttribute("data-color-preset", "amber")
  })

  it("renders a countdown as a progress bar once it has a start", () => {
    const item: Widget = {
      id: "year",
      kind: "countdown",
      title: "Year",
      colorPreset: "sky",
      settings: {
        startAt: "2026-01-01T00:00:00.000Z",
        targetAt: "2026-01-11T00:00:00.000Z"
      }
    }

    render(<BoardRow item={item} now={new Date("2026-01-06T00:00:00.000Z")} />)

    expect(screen.getByText("50%")).toBeInTheDocument()
    const bar = screen.getByRole("progressbar", { name: "Year progress" })
    expect(bar).toHaveAttribute("aria-valuenow", "50")
    // A full-width fill slid left by what remains, so the update is a compositor transform rather than a layout.
    expect(bar.querySelector(".progress-bar__fill")).toHaveStyle({
      transform: "translateX(-50%)"
    })
  })

  it("stops the bar short of complete while time is left", () => {
    const item: Widget = {
      id: "semester",
      kind: "countdown",
      title: "Semester",
      colorPreset: "sky",
      settings: {
        startAt: "2026-05-26T00:00:00.000Z",
        targetAt: "2026-08-05T00:00:00.000Z"
      }
    }

    render(
      <BoardRow item={item} now={new Date("2026-08-04T18:25:00.000Z")} />
    )

    expect(screen.getByText("99%")).toBeInTheDocument()
    expect(screen.getByText("5 hours, 35 minutes left")).toBeInTheDocument()
  })

  it("falls back to time remaining when a countdown has no start", () => {
    const item: Widget = {
      id: "year",
      kind: "countdown",
      title: "Year",
      colorPreset: "sky",
      settings: {
        targetAt: "2026-01-11T00:00:00.000Z"
      }
    }

    render(<BoardRow item={item} now={new Date("2026-01-06T00:00:00.000Z")} />)

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.getByText("5 days")).toBeInTheDocument()
  })

  it("reads a finished progress countdown as complete", () => {
    const item: Widget = {
      id: "sprint",
      kind: "countdown",
      title: "Sprint",
      colorPreset: "sky",
      settings: {
        startAt: "2026-01-01T00:00:00.000Z",
        targetAt: "2026-01-11T00:00:00.000Z"
      }
    }

    const { container } = render(
      <BoardRow item={item} now={new Date("2026-02-01T00:00:00.000Z")} />
    )

    expect(screen.getByText("100%")).toBeInTheDocument()
    expect(
      screen.getByRole("progressbar", { name: "Sprint progress" })
    ).toHaveAttribute("aria-valuenow", "100")
    // A full bar has its own closing word, so the line does not fall through to "21 days ago".
    expect(container.querySelector(".board-row__meta")).toHaveTextContent(
      "Complete"
    )
  })

  it("splits a passed countdown into the span and an ago line", () => {
    const item: Widget = {
      id: "shipped",
      kind: "countdown",
      title: "Shipped",
      colorPreset: "sky",
      settings: { targetAt: "2026-01-01T00:00:00.000Z" }
    }

    const { container } = render(
      <BoardRow item={item} now={new Date("2026-01-03T00:00:00.000Z")} />
    )

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(container.querySelector(".board-row__value")).toHaveTextContent(
      "2 days"
    )
    expect(container.querySelector(".board-row__meta")).toHaveTextContent("ago")
  })

  // The habit tests all want the same card and differ only in which days are already marked; unlike the other kinds, none of them assert on the title or the preset.
  const habit = (history: string[] = []): Widget => ({
    id: "habit",
    kind: "habit",
    title: "Read",
    colorPreset: "emerald",
    settings: { history }
  })

  it("marks today on a habit", () => {
    const now = new Date("2026-03-04T09:00:00.000Z")
    const item = habit()
    const onWidgetChange = vi.fn()

    render(<BoardRow item={item} now={now} onWidgetChange={onWidgetChange} />)

    const button = screen.getByRole("button", { name: "Mark today" })
    expect(button).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(button)

    expect(onWidgetChange).toHaveBeenCalledWith({
      ...item,
      settings: { history: [toDayKey(now)] }
    })
  })

  it("shows a completed habit as done in this week's dots", () => {
    const now = new Date("2026-03-04T09:00:00.000Z")
    const item = habit([toDayKey(now)])

    const { container } = render(<BoardRow item={item} now={now} />)

    expect(container.querySelectorAll(".habit-day")).toHaveLength(7)
    expect(container.querySelectorAll(".habit-day--done")).toHaveLength(1)
    expect(container.querySelector(".habit-day--done")).toHaveClass(
      "habit-day--today"
    )
    expect(
      screen.getByRole("button", { name: "Done today ✓" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("toggles an earlier day from its own dot", () => {
    const now = new Date(2026, 2, 4, 9, 0, 0)
    const monday = new Date(2026, 2, 2, 9, 0, 0)
    const item = habit([toDayKey(now)])
    const onWidgetChange = vi.fn()

    render(<BoardRow item={item} now={now} onWidgetChange={onWidgetChange} />)

    const dot = screen.getByRole("button", { name: formatDayLabel(monday) })
    expect(dot).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(dot)

    expect(onWidgetChange).toHaveBeenCalledWith({
      ...item,
      settings: { history: [toDayKey(monday), toDayKey(now)] }
    })
  })

  it("leaves the days that have not arrived yet alone", () => {
    const now = new Date(2026, 2, 4, 9, 0, 0)
    const item = habit()
    const onWidgetChange = vi.fn()

    const { container } = render(
      <BoardRow item={item} now={now} onWidgetChange={onWidgetChange} />
    )

    const tomorrow = screen.getByRole("button", {
      name: formatDayLabel(new Date(2026, 2, 5, 9, 0, 0))
    })
    expect(tomorrow).toBeDisabled()

    fireEvent.click(tomorrow)

    expect(onWidgetChange).not.toHaveBeenCalled()
    // Wednesday leaves Thursday through Sunday ahead of it.
    expect(container.querySelectorAll(".habit-day--future")).toHaveLength(4)
  })

  it("names the week the habit dots cover", () => {
    const now = new Date(2026, 2, 4, 9, 0, 0)
    const item = habit()

    render(<BoardRow item={item} now={now} />)

    expect(
      screen.getByRole("toolbar", { name: "This week" })
    ).toBeInTheDocument()
    expect(screen.getByText(/Mar 2\s*–\s*8/)).toBeInTheDocument()
    // Each dot names its own day for a pointer as well as a screen reader.
    expect(
      screen.getByRole("button", { name: formatDayLabel(now) })
    ).toHaveAttribute("title", formatDayLabel(now))
  })

  it("walks the habit week with the arrow keys from one tab stop", () => {
    const now = new Date(2026, 2, 4, 9, 0, 0)
    const dayAt = (date: number) => new Date(2026, 2, date, 9, 0, 0)
    const item = habit()

    render(<BoardRow item={item} now={now} />)

    const dot = (date: number) =>
      screen.getByRole("button", { name: formatDayLabel(dayAt(date)) })

    // Today is the row's only tab stop, so a board of habits stays walkable.
    expect(dot(4)).toHaveAttribute("tabindex", "0")
    expect(dot(2)).toHaveAttribute("tabindex", "-1")

    dot(4).focus()
    fireEvent.keyDown(dot(4), { key: "ArrowLeft" })
    expect(dot(3)).toHaveFocus()
    expect(dot(3)).toHaveAttribute("tabindex", "0")
    expect(dot(4)).toHaveAttribute("tabindex", "-1")

    fireEvent.keyDown(dot(3), { key: "Home" })
    expect(dot(2)).toHaveFocus()

    // Left from Monday and right past today both stay put: there is nothing behind the start of the week, and the days ahead cannot be marked.
    fireEvent.keyDown(dot(2), { key: "ArrowLeft" })
    expect(dot(2)).toHaveFocus()

    fireEvent.keyDown(dot(2), { key: "End" })
    expect(dot(4)).toHaveFocus()
    fireEvent.keyDown(dot(4), { key: "ArrowRight" })
    expect(dot(4)).toHaveFocus()
  })

  const todoAt = new Date("2026-01-01T12:30:00.000Z")
  const todo = (tasks: TodoTask[]): Widget => ({
    id: "list",
    kind: "todo",
    title: "Today",
    colorPreset: "mint",
    settings: { tasks }
  })

  it("checks a todo task off on the card", () => {
    const item = todo([
      { id: "a", text: "Buy milk", done: false },
      { id: "b", text: "Call the vet", done: true }
    ])
    const onWidgetChange = vi.fn()

    render(<BoardRow item={item} now={todoAt} onWidgetChange={onWidgetChange} />)

    const checkbox = screen.getByRole("checkbox", { name: "Buy milk" })
    expect(checkbox).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Call the vet" })).toBeChecked()

    fireEvent.click(checkbox)

    expect(onWidgetChange).toHaveBeenCalledWith(
      todo([
        { id: "a", text: "Buy milk", done: true },
        { id: "b", text: "Call the vet", done: true }
      ])
    )
  })

  it("adds a todo task from the card and clears the field", () => {
    const onWidgetChange = vi.fn()

    render(
      <BoardRow item={todo([])} now={todoAt} onWidgetChange={onWidgetChange} />
    )

    const field = screen.getByLabelText("Add a task to Today")

    // Nothing typed is nothing added, so Enter on an empty field is a no-op.
    fireEvent.submit(field)
    expect(onWidgetChange).not.toHaveBeenCalled()

    fireEvent.change(field, { target: { value: "Water the plants" } })
    fireEvent.submit(field)

    expect(onWidgetChange.mock.calls[0]![0].settings.tasks).toMatchObject([
      { text: "Water the plants", done: false }
    ])
    expect(field).toHaveValue("")
  })

  it("takes the add field away once the todo list is full, and brings it back", () => {
    const tasks = Array.from({ length: MAX_TASKS }, (_, index) => ({
      id: String(index),
      text: `Task ${index}`,
      done: false
    }))

    const { rerender } = render(<BoardRow item={todo(tasks)} now={todoAt} />)

    // Nowhere left to type is what says the list is full: there is no disabled box and no line of copy explaining the rule.
    // A live region carries the same news to anyone who can't see the field go.
    expect(screen.queryByLabelText("Add a task to Today")).not.toBeInTheDocument()
    expect(screen.getAllByRole("checkbox")).toHaveLength(MAX_TASKS)
    expect(screen.getByRole("status")).toHaveTextContent("Today is full")

    rerender(<BoardRow item={todo(tasks.slice(1))} now={todoAt} />)

    expect(screen.getByLabelText("Add a task to Today")).toBeInTheDocument()
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

    // A paused stopwatch reads the clock by the day, so the card's `now` can be hours stale; the run has to be stamped with the moment of the press.
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-01T12:34:56.789Z"))
    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    expect(onWidgetChange).toHaveBeenCalledTimes(1)
    expect(onWidgetChange).toHaveBeenCalledWith({
      ...item,
      settings: {
        running: true,
        elapsedMs: 0,
        startedAt: Date.parse("2026-01-01T12:34:56.789Z")
      }
    })
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
    // Mid-way and paused → the primary control offers to resume, counting down what was left from the moment of the press.
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-01T12:34:56.789Z"))
    fireEvent.click(screen.getByRole("button", { name: "Resume" }))
    expect(onWidgetChange).toHaveBeenCalledWith({
      ...item,
      settings: {
        ...item.settings,
        running: true,
        remainingMs: 120_000,
        endsAt: Date.parse("2026-01-01T12:34:56.789Z") + 120_000
      }
    })
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

  // Reaching zero settles every timer, but only a timer that asked for a chime is allowed to make a sound: an unasked-for one would be exactly the autoplay the product rules out.
  it("stays silent when a finished timer did not opt into the chime", () => {
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

    render(<BoardRow item={item} now={new Date(50_000)} onWidgetChange={vi.fn()} />)

    expect(vi.mocked(playChime)).not.toHaveBeenCalled()
  })

  it("sounds the chime once for a timer that opted in", () => {
    const item: Widget = {
      id: "t",
      kind: "timer",
      title: "Tea",
      colorPreset: "emerald",
      settings: {
        durationMs: 60_000,
        running: true,
        remainingMs: 60_000,
        endsAt: 1000,
        chime: true
      }
    }

    render(<BoardRow item={item} now={new Date(50_000)} onWidgetChange={vi.fn()} />)

    expect(vi.mocked(playChime)).toHaveBeenCalledTimes(1)
  })

  it("does not warm up audio when starting a timer with no chime", () => {
    const item: Widget = {
      id: "t",
      kind: "timer",
      title: "Tea",
      colorPreset: "emerald",
      settings: {
        durationMs: 60_000,
        running: false,
        remainingMs: 60_000,
        endsAt: null,
        chime: false
      }
    }

    render(<BoardRow item={item} now={new Date(0)} onWidgetChange={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    // Priming builds an audio context off the user's gesture; a silent timer should never reach for one.
    expect(vi.mocked(primeChime)).not.toHaveBeenCalled()
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

    const scratch: Widget = {
      id: "scratch",
      kind: "note",
      title: "Scratchpad",
      colorPreset: "slate",
      settings: { text: "" }
    }

    it("hands a pending note over the moment the page is hidden", () => {
      vi.useFakeTimers()
      const onWidgetChange = vi.fn()

      render(
        <BoardRow item={scratch} now={new Date()} onWidgetChange={onWidgetChange} />
      )
      fireEvent.change(screen.getByLabelText("Scratchpad note"), {
        target: { value: "Closing now" }
      })

      // Closing a tab hides it before it goes, with no blur and no unmount on the way.
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
      document.dispatchEvent(new Event("visibilitychange"))

      expect(onWidgetChange).toHaveBeenCalledTimes(1)
      expect(onWidgetChange).toHaveBeenCalledWith({
        ...scratch,
        settings: { text: "Closing now" }
      })

      // The timer it replaced does not save the same text a second time.
      vi.advanceTimersByTime(600)
      expect(onWidgetChange).toHaveBeenCalledTimes(1)
    })

    it("saves a pending note when the card unmounts", () => {
      vi.useFakeTimers()
      const onWidgetChange = vi.fn()

      const { unmount } = render(
        <BoardRow item={scratch} now={new Date()} onWidgetChange={onWidgetChange} />
      )
      fireEvent.change(screen.getByLabelText("Scratchpad note"), {
        target: { value: "Last words" }
      })
      unmount()

      expect(onWidgetChange).toHaveBeenCalledWith({
        ...scratch,
        settings: { text: "Last words" }
      })
    })

    it("builds a delayed note save on the widget as it is now, not as it was when typed", () => {
      vi.useFakeTimers()
      const onWidgetChange = vi.fn()

      const { rerender } = render(
        <BoardRow item={scratch} now={new Date()} onWidgetChange={onWidgetChange} />
      )
      fireEvent.change(screen.getByLabelText("Scratchpad note"), {
        target: { value: "Idea" }
      })

      // Archived from another tab while the save was still waiting.
      const archived = { ...scratch, archived: true }
      rerender(
        <BoardRow item={archived} now={new Date()} onWidgetChange={onWidgetChange} />
      )
      vi.advanceTimersByTime(600)

      expect(onWidgetChange).toHaveBeenCalledWith({
        ...archived,
        settings: { text: "Idea" }
      })
    })
  })
})

describe("CardBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const Throws = (): never => {
    throw new Error("unreadable card")
  }
  const note: Widget = {
    id: "n",
    kind: "note",
    title: "Groceries",
    colorPreset: "mint",
    settings: { text: "" }
  }

  it("shows the card's frame in place of a body that threw, and tries again once the widget changes", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const { rerender } = render(
      <CardBoundary fallback={<BoardRowFallback item={note} />} item={note}>
        <Throws />
      </CardBoundary>
    )

    expect(screen.getByRole("heading", { name: "Groceries" })).toBeInTheDocument()
    expect(screen.getByText("This card couldn’t be shown")).toBeInTheDocument()

    const edited = { ...note, title: "Shopping" }
    rerender(
      <CardBoundary fallback={<BoardRowFallback item={edited} />} item={edited}>
        <BoardRow item={edited} now={new Date()} />
      </CardBoundary>
    )

    expect(screen.getByLabelText("Shopping note")).toBeInTheDocument()
  })
})
