import { randomColorPreset } from "./colors"
import {
  type ClockWidget,
  type CountdownWidget,
  type NoteWidget,
  type QuoteWidget,
  type HabitWidget,
  type StopwatchWidget,
  type TimerWidget,
  type TodoWidget,
  type Widget,
  type WidgetKind
} from "./types"

export const DEFAULT_TIMER_DURATION_MS = 5 * 60 * 1000

export interface WidgetDefinition<K extends WidgetKind> {
  editor: {
    targetLabel?: string
  }
  createDefault: (now?: Date) => Extract<Widget, { kind: K }>
}

// Every kind opens the same way, so the one rule worth keeping in a single place is the color: a new card always arrives on a random colorful preset, never neutral slate.
const createBase = <K extends WidgetKind>(kind: K, title: string) => ({
  id: crypto.randomUUID(),
  kind,
  title,
  colorPreset: randomColorPreset()
})

// An empty zone follows the system clock, so a new card is right wherever the device is until a zone is chosen.
const createClockWidget = (): ClockWidget => ({
  ...createBase("clock", "New clock"),
  settings: {
    timeZone: ""
  }
})

// A new countdown has no start, so the card shows the time remaining; setting a start in the dialog is what turns it into a progress bar.
const createCountdownWidget = (now = new Date()): CountdownWidget => {
  const target = new Date(now)
  target.setHours(target.getHours() + 1, 0, 0, 0)

  return {
    ...createBase("countdown", "New countdown"),
    settings: {
      targetAt: target.toISOString()
    }
  }
}

const createNoteWidget = (): NoteWidget => ({
  ...createBase("note", "New note"),
  settings: {
    text: ""
  }
})

const createQuoteWidget = (): QuoteWidget => ({
  ...createBase("quote", "Daily quote"),
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
  ...createBase("stopwatch", "Stopwatch"),
  settings: {
    running: false,
    elapsedMs: 0,
    startedAt: null
  }
})

const createHabitWidget = (): HabitWidget => ({
  ...createBase("habit", "New habit"),
  settings: {
    history: []
  }
})

// A new list starts empty rather than with sample tasks: the first thing you do with a todo card is type your own, and pre-filled rows would only be things to check off and delete.
const createTodoWidget = (): TodoWidget => ({
  ...createBase("todo", "New list"),
  settings: {
    tasks: []
  }
})

const createTimerWidget = (): TimerWidget => ({
  ...createBase("timer", "Timer"),
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
    editor: {},
    createDefault: createClockWidget
  },
  countdown: {
    editor: {
      targetLabel: "When"
    },
    createDefault: createCountdownWidget
  },
  note: {
    editor: {},
    createDefault: createNoteWidget
  },
  quote: {
    editor: {},
    createDefault: createQuoteWidget
  },
  stopwatch: {
    editor: {},
    createDefault: createStopwatchWidget
  },
  timer: {
    editor: {},
    createDefault: createTimerWidget
  },
  habit: {
    editor: {},
    createDefault: createHabitWidget
  },
  todo: {
    editor: {},
    createDefault: createTodoWidget
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

// Move an active (non-archived) widget one step up or down relative to the other active widgets.
// The board only shows active widgets, and archived ones are not guaranteed to sit after them in storage, since a widget added once something is archived lands past it.
// So the menu's Move back/next must act on the visible neighbor rather than the raw array neighbor, which could be a hidden archived widget, making the move a silent no-op.
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

// Archiving moves the widget to the end so the active widgets stay a contiguous block at the front.
// That keeps index-based moves (the menu's Move back/next) lined up with what is actually on the board.
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

// Restoring drops the widget back in just after the last active widget, so it rejoins the bottom of the board rather than the top.
// When `beforeId` names an active widget (the board card an archived one was dropped onto) the widget takes that card's slot instead, pushing it and everything after one step down.
export const restoreWidget = (
  widgets: Widget[],
  id: string,
  beforeId?: string
): Widget[] => {
  const target = widgets.find((widget) => widget.id === id)

  if (!target || !target.archived) {
    return widgets
  }

  const rest = widgets.filter((widget) => widget.id !== id)
  const restored = { ...target, archived: false }

  let insertAt = beforeId
    ? rest.findIndex((widget) => widget.id === beforeId && !widget.archived)
    : -1

  if (insertAt === -1) {
    insertAt = 0
    rest.forEach((widget, index) => {
      if (!widget.archived) {
        insertAt = index + 1
      }
    })
  }

  return [...rest.slice(0, insertAt), restored, ...rest.slice(insertAt)]
}
