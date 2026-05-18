export type WidgetKind = "clock" | "countdown"

export type WidgetPlacement = "main" | "more"

export interface WidgetBase {
  id: string
  kind: WidgetKind
  title: string
  placement: WidgetPlacement
  createdAt: string
  updatedAt: string
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

export type Widget = ClockWidget | CountdownWidget

export interface ClockboardState {
  widgets: Widget[]
}

export const DEFAULT_TIME_ZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

export const DEFAULT_WIDGET_PLACEMENT: WidgetPlacement = "main"

export const createDefaultWidgets = (now = new Date()): Widget[] => {
  const createdAt = now.toISOString()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)

  return [
    {
      id: "home-clock",
      kind: "clock",
      title: "Local time",
      placement: DEFAULT_WIDGET_PLACEMENT,
      settings: {
        timeZone: DEFAULT_TIME_ZONE
      },
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "tomorrow-countdown",
      kind: "countdown",
      title: "Tomorrow morning",
      placement: DEFAULT_WIDGET_PLACEMENT,
      settings: {
        targetAt: tomorrow.toISOString()
      },
      createdAt,
      updatedAt: createdAt
    }
  ]
}

export const createDefaultState = (now = new Date()): ClockboardState => ({
  widgets: createDefaultWidgets(now)
})

export const toDateTimeInputValue = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day}T${hour}:${minute}`
}
