export type ItemKind = "clock" | "countdown"
export type BoardLayout = "focus" | "grid" | "compact"
export type BoardDensity = "comfortable" | "condensed"
export type BoardDetailLevel = "minimal" | "balanced" | "rich"
export type ClockPrecision = "minutes" | "seconds"

export interface BoardItemBase {
  id: string
  kind: ItemKind
  title: string
  timeZone: string
  createdAt: string
  updatedAt: string
}

export interface ClockItem extends BoardItemBase {
  kind: "clock"
}

export interface CountdownItem extends BoardItemBase {
  kind: "countdown"
  targetDateTime: string
}

export type BoardItem = ClockItem | CountdownItem

export interface ClockboardSettings {
  boardTitle: string
  showDate: boolean
  layout: BoardLayout
  density: BoardDensity
  detailLevel: BoardDetailLevel
  clockPrecision: ClockPrecision
}

export interface ClockboardState {
  version: 2
  settings: ClockboardSettings
  items: BoardItem[]
}

export const DEFAULT_TIME_ZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

export const DEFAULT_SETTINGS: ClockboardSettings = {
  boardTitle: "Clockboard",
  showDate: true,
  layout: "focus",
  density: "comfortable",
  detailLevel: "balanced",
  clockPrecision: "minutes"
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
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "tomorrow-countdown",
      kind: "countdown",
      title: "Tomorrow morning",
      timeZone: DEFAULT_TIME_ZONE,
      targetDateTime: toDateTimeInputValue(tomorrow),
      createdAt,
      updatedAt: createdAt
    }
  ]
}

export const createDefaultState = (now = new Date()): ClockboardState => ({
  version: 2,
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
