import {
  DEFAULT_TIME_ZONE,
  DEFAULT_COLOR_PRESET,
  type ClockWidget,
  type CountdownWidget,
  type NoteWidget,
  type QuoteWidget,
  type HabitWidget,
  type StopwatchWidget,
  type TimerWidget,
  type Widget,
  type WidgetKind
} from "./types"

const DEFAULT_TIMER_DURATION_MS = 5 * 60 * 1000

export interface WidgetDefinition<K extends WidgetKind> {
  kind: K
  editor: {
    targetLabel?: string
  }
  createDefault: (now?: Date) => Extract<Widget, { kind: K }>
}

const createClockWidget = (): ClockWidget => ({
  id: crypto.randomUUID(),
  kind: "clock",
  title: "New clock",
  colorPreset: DEFAULT_COLOR_PRESET,
  settings: {
    timeZone: DEFAULT_TIME_ZONE
  }
})

const createCountdownWidget = (now = new Date()): CountdownWidget => {
  const target = new Date(now)
  target.setHours(target.getHours() + 1, 0, 0, 0)

  return {
    id: crypto.randomUUID(),
    kind: "countdown",
    title: "New countdown",
    colorPreset: DEFAULT_COLOR_PRESET,
    settings: {
      targetAt: target.toISOString()
    }
  }
}

const createNoteWidget = (): NoteWidget => ({
  id: crypto.randomUUID(),
  kind: "note",
  title: "New note",
  colorPreset: DEFAULT_COLOR_PRESET,
  settings: {
    text: ""
  }
})

const createQuoteWidget = (): QuoteWidget => ({
  id: crypto.randomUUID(),
  kind: "quote",
  title: "Daily quote",
  colorPreset: DEFAULT_COLOR_PRESET,
  settings: {
    quotes: [
      "The secret of getting ahead is getting started.",
      "Small steps every day.",
      "Done is better than perfect."
    ],
    rotation: "daily"
  }
})

const createStopwatchWidget = (): StopwatchWidget => ({
  id: crypto.randomUUID(),
  kind: "stopwatch",
  title: "Stopwatch",
  colorPreset: DEFAULT_COLOR_PRESET,
  settings: {
    running: false,
    elapsedMs: 0,
    startedAt: null
  }
})

const createHabitWidget = (): HabitWidget => ({
  id: crypto.randomUUID(),
  kind: "habit",
  title: "New habit",
  colorPreset: DEFAULT_COLOR_PRESET,
  settings: {
    history: []
  }
})

const createTimerWidget = (): TimerWidget => ({
  id: crypto.randomUUID(),
  kind: "timer",
  title: "Timer",
  colorPreset: DEFAULT_COLOR_PRESET,
  settings: {
    durationMs: DEFAULT_TIMER_DURATION_MS,
    running: false,
    remainingMs: DEFAULT_TIMER_DURATION_MS,
    endsAt: null,
    chime: false
  }
})

export const widgetRegistry: {
  [K in WidgetKind]: WidgetDefinition<K>
} = {
  clock: {
    kind: "clock",
    editor: {},
    createDefault: createClockWidget
  },
  countdown: {
    kind: "countdown",
    editor: {
      targetLabel: "When"
    },
    createDefault: createCountdownWidget
  },
  note: {
    kind: "note",
    editor: {},
    createDefault: createNoteWidget
  },
  quote: {
    kind: "quote",
    editor: {},
    createDefault: createQuoteWidget
  },
  stopwatch: {
    kind: "stopwatch",
    editor: {},
    createDefault: createStopwatchWidget
  },
  timer: {
    kind: "timer",
    editor: {},
    createDefault: createTimerWidget
  },
  habit: {
    kind: "habit",
    editor: {},
    createDefault: createHabitWidget
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

// Move an active (non-archived) widget one step up or down relative to the
// other active widgets. The board only shows active widgets, and archived ones
// are not guaranteed to sit after them in storage — a widget added once
// something is archived lands past it — so the menu's Move up/down must reorder
// against the visible neighbor rather than the raw array neighbor (which could
// be a hidden archived widget, making the move a silent no-op).
export const moveActiveWidget = (
  widgets: Widget[],
  id: string,
  direction: -1 | 1
): Widget[] => {
  const active = widgets.filter((widget) => !widget.archived)
  const fromIndex = active.findIndex((widget) => widget.id === id)

  if (fromIndex === -1) {
    return widgets
  }

  const neighbor = active[fromIndex + direction]

  if (!neighbor) {
    return widgets
  }

  return reorderWidgets(widgets, id, neighbor.id)
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

// Archiving moves the widget to the end so the active widgets stay a contiguous
// block at the front. That keeps index-based moves (the menu's Move up/down)
// lined up with what is actually on the board.
export const archiveWidget = (widgets: Widget[], id: string): Widget[] => {
  const target = widgets.find((widget) => widget.id === id)

  if (!target || target.archived) {
    return widgets
  }

  return [
    ...widgets.filter((widget) => widget.id !== id),
    { ...target, archived: true }
  ]
}

// Restoring drops the widget back in just after the last active widget, so it
// rejoins the bottom of the board rather than the top.
export const restoreWidget = (widgets: Widget[], id: string): Widget[] => {
  const target = widgets.find((widget) => widget.id === id)

  if (!target || !target.archived) {
    return widgets
  }

  const rest = widgets.filter((widget) => widget.id !== id)
  const restored = { ...target, archived: false }

  let insertAt = 0
  rest.forEach((widget, index) => {
    if (!widget.archived) {
      insertAt = index + 1
    }
  })

  return [...rest.slice(0, insertAt), restored, ...rest.slice(insertAt)]
}
