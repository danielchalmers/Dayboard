export type WidgetKind = "clock" | "countdown" | "note"

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
}

export interface ClockWidget extends WidgetBase {
  kind: "clock"
  settings: {
    timeZone: string
  }
}

export interface CountdownWidget extends WidgetBase {
  kind: "countdown"
  settings: {
    targetAt: string
  }
}

export interface NoteWidget extends WidgetBase {
  kind: "note"
  settings: {
    text: string
  }
}

export type Widget = ClockWidget | CountdownWidget | NoteWidget

export type BoardColumns = "auto" | 1 | 2 | 3 | 4

export const BOARD_COLUMN_CHOICES: BoardColumns[] = ["auto", 1, 2, 3, 4]

export interface ClockboardSettings {
  /** Whether widgets can be dragged to rearrange the board. */
  dragToMove: boolean
  /** Fixed number of board columns, or `auto` for the responsive default. */
  columns: BoardColumns
}

export const DEFAULT_SETTINGS: ClockboardSettings = {
  dragToMove: true,
  columns: "auto"
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
