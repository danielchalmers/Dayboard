export type ItemKind = "clock" | "countdown"

export type ClockFormat = "12h" | "24h"

export type BoardDensity = "comfortable" | "compact"

export interface BoardItemBase {
  id: string
  kind: ItemKind
  title: string
  timeZone: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface ClockItem extends BoardItemBase {
  kind: "clock"
  format: ClockFormat
  showSeconds: boolean
}

export interface CountdownItem extends BoardItemBase {
  kind: "countdown"
  targetDateTime: string
  showSeconds: boolean
}

export type BoardItem = ClockItem | CountdownItem

export interface ClockboardSettings {
  boardTitle: string
  density: BoardDensity
  showDate: boolean
}

export interface ClockboardState {
  version: 1
  settings: ClockboardSettings
  items: BoardItem[]
}

export const DEFAULT_TIME_ZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

export const DEFAULT_COLORS = [
  "#0f9f8f",
  "#f2b84b",
  "#d95763",
  "#4f7cac",
  "#7b6dd6",
  "#477a47"
]

export const DEFAULT_SETTINGS: ClockboardSettings = {
  boardTitle: "Clockboard",
  density: "comfortable",
  showDate: true
}

export const createDefaultItems = (now = new Date()): BoardItem[] => {
  const createdAt = now.toISOString()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)

  return [
    {
      id: "home-clock",
      kind: "clock",
      title: "Local time",
      timeZone: DEFAULT_TIME_ZONE,
      color: DEFAULT_COLORS[0]!,
      format: "12h",
      showSeconds: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "tomorrow-countdown",
      kind: "countdown",
      title: "Tomorrow morning",
      timeZone: DEFAULT_TIME_ZONE,
      color: DEFAULT_COLORS[1]!,
      targetDateTime: toDateTimeInputValue(tomorrow),
      showSeconds: false,
      createdAt,
      updatedAt: createdAt
    }
  ]
}

export const createDefaultState = (now = new Date()): ClockboardState => ({
  version: 1,
  settings: DEFAULT_SETTINGS,
  items: createDefaultItems(now)
})

export const toDateTimeInputValue = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day}T${hour}:${minute}`
}
