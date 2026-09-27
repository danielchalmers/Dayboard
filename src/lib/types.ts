import type { TodoTask } from "./todo"

export type WidgetKind =
  | "clock"
  | "countdown"
  | "note"
  | "quote"
  | "stopwatch"
  | "timer"
  | "habit"
  | "todo"

export type QuoteRotation = "daily" | "open"

export type WidgetColorPreset =
  | "slate"
  | "rose"
  | "coral"
  | "amber"
  | "lemon"
  | "mint"
  | "emerald"
  | "teal"
  | "sky"
  | "indigo"
  | "violet"
  | "fuchsia"

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
    /**
     * IANA zone name, or empty to follow the system clock.
     * An empty zone is the default for a new clock: the card reads whatever zone the device is in right now, so it changes with the machine when traveling.
     */
    timeZone: string
  }
}

export type CountdownRepeat =
  | "none"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"

export interface CountdownWidget extends WidgetBase {
  kind: "countdown"
  settings: {
    targetAt: string
    /**
     * Span start for the progress bar (the target is the span end).
     * Setting a start is what turns the card into a progress bar; clearing it (the default for a new countdown) shows the remaining-time text.
     */
    startAt?: string
    /** When set, the target rolls forward to the next occurrence as it passes. */
    repeat?: CountdownRepeat
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
    /** Play a soft chime when this timer reaches zero (opt-in, per timer). */
    chime?: boolean
  }
}

export interface HabitWidget extends WidgetBase {
  kind: "habit"
  settings: {
    /**
     * Local day keys (YYYY-MM-DD) on which the habit was marked done, pruned to the week the dot row can show.
     * An unbounded list eventually grew into the chrome.storage.sync per-item quota the whole board shares.
     */
    history: string[]
  }
}

export interface TodoWidget extends WidgetBase {
  kind: "todo"
  settings: {
    /** The list in the order it was written; checking a task leaves it in place. */
    tasks: TodoTask[]
  }
}

export type Widget =
  | ClockWidget
  | CountdownWidget
  | NoteWidget
  | QuoteWidget
  | StopwatchWidget
  | TimerWidget
  | HabitWidget
  | TodoWidget

// Dayboard's philosophy is that the board just works: the layout is responsive, dragging is always available, and the board centers itself in the viewport.
// The only setting left is the optional greeting name.
export interface DayboardSettings {
  /** Optional name used to personalize the greeting; empty hides it. */
  name: string
}

export const DEFAULT_SETTINGS: DayboardSettings = {
  name: ""
}

export interface DayboardState {
  widgets: Widget[]
  settings: DayboardSettings
}

// The first-run board.
// It is intentionally pre-styled with a varied, calm mix of widget kinds and curated colors so a brand-new tab feels customized at a glance and shows what the board can do, rather than a blank two-card placeholder.
// Each title opens with an emoji, both because it warms up the first board and because it shows that a title is free text you can put anything in.
// Everything here is editable; these are just inviting starting points.
export const createDefaultWidgets = (now = new Date()): Widget[] => {
  // Tomorrow at 9am local, repeating daily so this anchor stays evergreen instead of slipping into the past after the first day.
  const tomorrowMorning = new Date(now)
  tomorrowMorning.setDate(now.getDate() + 1)
  tomorrowMorning.setHours(9, 0, 0, 0)

  // The current calendar year as a fixed span.
  // `now` always sits inside it, so the progress bar reads as a meaningful fraction on first paint and never needs to roll forward.
  const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0)

  return [
    {
      id: "home-clock",
      kind: "clock",
      title: "🕒 Local time",
      colorPreset: "sky",
      settings: {
        // Empty means the system clock: the first-run card genuinely is local time, wherever the device goes.
        timeZone: ""
      }
    },
    {
      id: "tomorrow-countdown",
      kind: "countdown",
      title: "🌅 Tomorrow morning",
      colorPreset: "indigo",
      settings: {
        targetAt: tomorrowMorning.toISOString(),
        repeat: "daily"
      }
    },
    {
      id: "welcome-note",
      kind: "note",
      title: "👋 Welcome",
      colorPreset: "emerald",
      settings: {
        text: "Good to have you here. This is your space for the day. Keep what helps, change what doesn't, and let the rest be quiet."
      }
    },
    {
      id: "reminder-quote",
      kind: "quote",
      title: "💬 Today's reminder",
      colorPreset: "violet",
      settings: {
        quotes: [
          "Begin where you are; that is always enough.",
          "One small thing, done well.",
          "Quiet days still count.",
          "Breathe. The rest can wait a moment."
        ],
        rotation: "daily"
      }
    },
    {
      id: "daily-walk-habit",
      kind: "habit",
      title: "🚶 Daily walk",
      colorPreset: "amber",
      settings: {
        history: []
      }
    },
    {
      id: "year-progress",
      kind: "countdown",
      title: "📅 This year",
      colorPreset: "rose",
      settings: {
        targetAt: yearEnd.toISOString(),
        startAt: yearStart.toISOString()
      }
    }
  ]
}

export const createDefaultState = (now = new Date()): DayboardState => ({
  widgets: createDefaultWidgets(now),
  settings: { ...DEFAULT_SETTINGS }
})

export const toDateTimeInputValue = (date: Date): string => {
  // A datetime-local value needs a four-digit year, so the year 50 has to read "0050" or the field treats it as empty.
  const year = String(date.getFullYear()).padStart(4, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day}T${hour}:${minute}`
}
