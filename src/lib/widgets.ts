import {
  DEFAULT_TIME_ZONE,
  DEFAULT_WIDGET_PLACEMENT,
  type ClockWidget,
  type CountdownWidget,
  type Widget,
  type WidgetKind,
  type WidgetPlacement
} from "./types"

export interface WidgetDefinition<K extends WidgetKind> {
  kind: K
  kindLabel: string
  editor: {
    hasTimeZone: boolean
    targetLabel?: string
  }
  createDefault: (now?: Date) => Extract<Widget, { kind: K }>
}

const createClockWidget = (now = new Date()): ClockWidget => {
  const timestamp = now.toISOString()

  return {
    id: crypto.randomUUID(),
    kind: "clock",
    title: "New clock",
    placement: DEFAULT_WIDGET_PLACEMENT,
    settings: {
      timeZone: DEFAULT_TIME_ZONE
    },
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

const createCountdownWidget = (now = new Date()): CountdownWidget => {
  const timestamp = now.toISOString()
  const target = new Date(now)
  target.setHours(target.getHours() + 1, 0, 0, 0)

  return {
    id: crypto.randomUUID(),
    kind: "countdown",
    title: "New countdown",
    placement: DEFAULT_WIDGET_PLACEMENT,
    settings: {
      targetAt: target.toISOString()
    },
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export const widgetRegistry: {
  [K in WidgetKind]: WidgetDefinition<K>
} = {
  clock: {
    kind: "clock",
    kindLabel: "Clock",
    editor: {
      hasTimeZone: true
    },
    createDefault: createClockWidget
  },
  countdown: {
    kind: "countdown",
    kindLabel: "Countdown",
    editor: {
      hasTimeZone: false,
      targetLabel: "When"
    },
    createDefault: createCountdownWidget
  }
}

export const createWidget = <K extends WidgetKind>(
  kind: K,
  now = new Date()
): Extract<Widget, { kind: K }> => widgetRegistry[kind].createDefault(now)

export const moveWidgetToIndex = (
  widgets: Widget[],
  fromIndex: number,
  toIndex: number
): Widget[] => {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= widgets.length ||
    toIndex >= widgets.length
  ) {
    return widgets
  }

  const nextWidgets = [...widgets]
  const [widget] = nextWidgets.splice(fromIndex, 1)

  if (!widget) {
    return widgets
  }

  nextWidgets.splice(toIndex, 0, widget)
  return nextWidgets
}

export const getWidgetsByPlacement = (
  widgets: Widget[],
  placement: WidgetPlacement
): Widget[] => widgets.filter((widget) => widget.placement === placement)

const replacePlacementWidgets = (
  widgets: Widget[],
  placement: WidgetPlacement,
  placedWidgets: Widget[]
): Widget[] => {
  const otherPlacement = placement === "main" ? "more" : "main"

  return placement === "main"
    ? [...placedWidgets, ...getWidgetsByPlacement(widgets, otherPlacement)]
    : [...getWidgetsByPlacement(widgets, otherPlacement), ...placedWidgets]
}

export const moveWidget = (
  widgets: Widget[],
  id: string,
  direction: -1 | 1
): Widget[] => {
  const index = widgets.findIndex((widget) => widget.id === id)
  return moveWidgetToIndex(widgets, index, index + direction)
}

export const moveWidgetWithinPlacement = (
  widgets: Widget[],
  id: string,
  direction: -1 | 1
): Widget[] => {
  const widget = widgets.find((current) => current.id === id)

  if (!widget) {
    return widgets
  }

  const placedWidgets = getWidgetsByPlacement(widgets, widget.placement)
  const index = placedWidgets.findIndex((current) => current.id === id)
  const nextPlacedWidgets = moveWidgetToIndex(
    placedWidgets,
    index,
    index + direction
  )

  return nextPlacedWidgets === placedWidgets
    ? widgets
    : replacePlacementWidgets(widgets, widget.placement, nextPlacedWidgets)
}

export const moveWidgetToPlacement = (
  widgets: Widget[],
  id: string,
  placement: WidgetPlacement
): Widget[] => {
  const widget = widgets.find((current) => current.id === id)

  if (!widget || widget.placement === placement) {
    return widgets
  }

  const movedWidget = {
    ...widget,
    placement,
    updatedAt: new Date().toISOString()
  }
  const nextWidgets = widgets.filter((current) => current.id !== id)

  return placement === "main"
    ? [
        ...getWidgetsByPlacement(nextWidgets, "main"),
        movedWidget,
        ...getWidgetsByPlacement(nextWidgets, "more")
      ]
    : [
        ...getWidgetsByPlacement(nextWidgets, "main"),
        ...getWidgetsByPlacement(nextWidgets, "more"),
        movedWidget
      ]
}

export const reorderWidgets = (
  widgets: Widget[],
  activeId: string,
  overId: string
): Widget[] => {
  if (activeId === overId) {
    return widgets
  }

  const fromIndex = widgets.findIndex((widget) => widget.id === activeId)
  const toIndex = widgets.findIndex((widget) => widget.id === overId)

  return moveWidgetToIndex(widgets, fromIndex, toIndex)
}

export const reorderWidgetsWithinPlacement = (
  widgets: Widget[],
  activeId: string,
  overId: string
): Widget[] => {
  if (activeId === overId) {
    return widgets
  }

  const activeWidget = widgets.find((widget) => widget.id === activeId)
  const overWidget = widgets.find((widget) => widget.id === overId)

  if (!activeWidget || !overWidget || activeWidget.placement !== overWidget.placement) {
    return widgets
  }

  const placedWidgets = getWidgetsByPlacement(widgets, activeWidget.placement)
  const fromIndex = placedWidgets.findIndex((widget) => widget.id === activeId)
  const toIndex = placedWidgets.findIndex((widget) => widget.id === overId)
  const nextPlacedWidgets = moveWidgetToIndex(placedWidgets, fromIndex, toIndex)

  return nextPlacedWidgets === placedWidgets
    ? widgets
    : replacePlacementWidgets(widgets, activeWidget.placement, nextPlacedWidgets)
}
