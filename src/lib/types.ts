export type WidgetKind =
  | "clock"
  | "countdown"
  | "note"
  | "quote"
  | "stopwatch"
  | "timer"

export type QuoteRotation = "daily" | "open"

export type WidgetColorPreset =
  | "slate"
  | "rose"
  | "amber"
  | "emerald"
  | "sky"
  | "violet"
  | "teal"
  | "coral"
  | "indigo"
  | "mint"

export const DEFAULT_COLOR_PRESET: WidgetColorPreset = "slate"

export interface WidgetBase {
  id: string
  kind: WidgetKind
  title: string
  colorPreset: WidgetColorPreset
  /** Tucked away in the Archived section and hidden from the main board. */
  archived?: boolean
}

export interface ClockWidget extends WidgetBase {
  kind: "clock"
  settings: {
    timeZone: string
  }
}

export type CountdownDisplay = "text" | "progress"

export interface CountdownWidget extends WidgetBase {
  kind: "countdown"
  settings: {
    targetAt: string
    /** How to present the countdown; defaults to the remaining-time text. */
    display?: CountdownDisplay
    /** Span start for the progress bar (the target is the span end). */
    startAt?: string
  }
}

export interface NoteWidget extends WidgetBase {
  kind: "note"
  settings: {
    text: string
  }
}

export interface QuoteWidget extends WidgetBase {
  kind: "quote"
  settings: {
    /** The master list this widget draws from, one quote per entry. */
    quotes: string[]
    /** When to surface a new quote from the list. */
    rotation: QuoteRotation
  }
}

export interface StopwatchWidget extends WidgetBase {
  kind: "stopwatch"
  settings: {
    /** Whether the stopwatch is currently counting up. */
    running: boolean
    /** Milliseconds banked from previous runs (the value while paused). */
    elapsedMs: number
    /** Epoch ms of the current run's start, or null while paused. */
    startedAt: number | null
  }
}

export interface TimerWidget extends WidgetBase {
  kind: "timer"
  settings: {
    /** The configured countdown length. */
    durationMs: number
    /** Whether the timer is currently counting down. */
    running: boolean
    /** Milliseconds left while paused or reset. */
    remainingMs: number
    /** Epoch ms when the timer will reach zero, or null while paused. */
    endsAt: number | null
  }
}

export type Widget =
  | ClockWidget
  | CountdownWidget
  | NoteWidget
  | QuoteWidget
  | StopwatchWidget
  | TimerWidget

export type BoardColumns = "auto" | 1 | 2 | 3 | 4

export const BOARD_COLUMN_CHOICES: BoardColumns[] = ["auto", 1, 2, 3, 4]

export interface ClockboardSettings {
  /** Whether widgets can be dragged to rearrange the board. */
  dragToMove: boolean
  /** Fixed number of board columns, or `auto` for the responsive default. */
  columns: BoardColumns
  /** Optional name used to personalize the greeting; empty hides it. */
  name: string
}

export const DEFAULT_SETTINGS: ClockboardSettings = {
  dragToMove: true,
  columns: "auto",
  name: ""
}

export interface ClockboardState {
  widgets: Widget[]
  settings: ClockboardSettings
}

export const DEFAULT_TIME_ZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

export const createDefaultWidgets = (now = new Date()): Widget[] => {
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)

  return [
    {
      id: "home-clock",
      kind: "clock",
      title: "Local time",
      colorPreset: DEFAULT_COLOR_PRESET,
      settings: {
        timeZone: DEFAULT_TIME_ZONE
      }
    },
    {
      id: "tomorrow-countdown",
      kind: "countdown",
      title: "Tomorrow morning",
      colorPreset: DEFAULT_COLOR_PRESET,
      settings: {
        targetAt: tomorrow.toISOString()
      }
    }
  ]
}

export const createDefaultState = (now = new Date()): ClockboardState => ({
  widgets: createDefaultWidgets(now),
  settings: { ...DEFAULT_SETTINGS }
})

export const toDateTimeInputValue = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day}T${hour}:${minute}`
}
