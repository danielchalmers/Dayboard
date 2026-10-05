import { COLOR_PRESETS } from "./colors"
import {
  DEFAULT_SETTINGS,
  createDefaultState,
  type CountdownRepeat,
  type CountdownWidget,
  type DayboardSettings,
  type DayboardState,
  type UnknownWidget,
  type Widget
} from "./types"
import { normalizeHistory } from "./habit"
import { normalizeTasks } from "./todo"
import { DEFAULT_TIMER_DURATION_MS, widgetRegistry } from "./widgets"

export const STORAGE_KEY = "dayboard-state"
export const CACHE_KEY = "dayboard-state-cache"

const hasWidgets = (value: unknown): value is { widgets: unknown[] } =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { widgets?: unknown }).widgets)

type StoredWidget = UnknownWidget["widget"]

// Keep only entries that look like widgets, so a hand-edited or imported file with junk rows renders the valid widgets instead of blank cards.
// A settings object has to be among them: normalization and the cards both read straight through it, so an entry missing one throws on the way in and takes the whole board with it rather than being dropped like the rest of the junk.
const isWidgetShaped = (value: unknown): value is StoredWidget =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as StoredWidget).id === "string" &&
  typeof (value as StoredWidget).kind === "string" &&
  typeof (value as StoredWidget).settings === "object" &&
  (value as StoredWidget).settings !== null

// An own key, not `in`: the registry is a plain object, so `in` also lets through kinds such as "toString" off its prototype.
const isKnownWidget = (widget: StoredWidget): widget is Widget =>
  Object.hasOwn(widgetRegistry, widget.kind)

// Fill any missing or malformed fields with their defaults so a partial or hand-edited imported board still loads cleanly, and carry the rest through for the version that wrote them.
const normalizeSettings = (value: unknown): DayboardSettings => {
  const stored = (typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {}) as Partial<DayboardSettings>

  return {
    ...stored,
    name: typeof stored.name === "string" ? stored.name : DEFAULT_SETTINGS.name
  }
}

const REPEATS: CountdownRepeat[] = ["none", "hourly", "daily", "weekly", "monthly", "yearly"]

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const span = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback

const instant = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

type StoredSettings = Record<string, unknown>

// Countdowns used to carry a `display` setting choosing between the remaining time and a progress bar; a start date is now the only switch.
// Boards written before that still carry the key, so retire it on read, dropping the start alongside it when the card was set to text, which would otherwise come back as a bar the owner never asked for.
// A repeat this build does not know is dropped rather than stepped by, since stepping by it runs the target off into an invalid date that throws on its way to the screen.
const normalizeCountdown = ({
  display,
  startAt,
  repeat,
  ...settings
}: StoredSettings): CountdownWidget["settings"] => {
  const known = REPEATS.find((option) => option === repeat)

  return {
    ...settings,
    targetAt: text(settings.targetAt),
    ...(typeof startAt === "string" && (display === undefined || display === "progress")
      ? { startAt }
      : {}),
    ...(known ? { repeat: known } : {})
  }
}

// Every card reads its settings straight from render, so one field of the wrong type (a hand-edited import, or a board synced in from a different version of Dayboard) would throw there and blank the whole page.
// So each field a card reads is checked here and falls back to what a new card starts with, while fields this build doesn't know are carried through untouched for the version that wrote them.
// Habit history is pruned to the visible week: it was once stored unbounded, which after a year or two blew the sync per-item quota and made every save fail.
// Todo lists are held to the same limits the card enforces, so an imported file cannot arrive carrying more than a board can save.
// Neither rebuilds the settings around that one field, though: an older build that did would strip whatever a newer one keeps beside it the first time it saved.
const normalizeWidgetSettings = (
  kind: Widget["kind"],
  settings: StoredSettings
): Widget["settings"] => {
  switch (kind) {
    case "clock":
      return { ...settings, timeZone: text(settings.timeZone) }
    case "countdown":
      return normalizeCountdown(settings)
    case "note":
      return { ...settings, text: text(settings.text) }
    case "quote":
      return {
        ...settings,
        quotes: Array.isArray(settings.quotes)
          ? settings.quotes.filter((quote) => typeof quote === "string")
          : [],
        rotation: settings.rotation === "open" ? "open" : "daily"
      }
    case "stopwatch": {
      const startedAt = instant(settings.startedAt)

      return {
        ...settings,
        running: settings.running === true && startedAt !== null,
        elapsedMs: span(settings.elapsedMs, 0),
        startedAt
      }
    }
    case "timer": {
      const durationMs = span(settings.durationMs, 0) || DEFAULT_TIMER_DURATION_MS
      const endsAt = instant(settings.endsAt)

      return {
        ...settings,
        durationMs,
        running: settings.running === true && endsAt !== null,
        remainingMs: span(settings.remainingMs, durationMs),
        endsAt,
        chime: settings.chime === true
      }
    }
    case "habit":
      return { ...settings, history: normalizeHistory(settings.history) }
    case "todo":
      return { ...settings, tasks: normalizeTasks(settings.tasks) }
  }
}

// The first-run "This year" card used to be saved as that one year's span with no repeat, so from New Year's Day it sat at Complete for good.
// It starts out repeating yearly now; a board saved with the old card, its span still the calendar year it was made in, reads as that too.
const renewFirstRunYear = (widget: Widget): Widget => {
  if (
    widget.id !== "year-progress" ||
    widget.kind !== "countdown" ||
    widget.settings.repeat !== undefined ||
    !widget.settings.startAt
  ) {
    return widget
  }

  const start = new Date(widget.settings.startAt)
  const isCalendarYear =
    start.getTime() === new Date(start.getFullYear(), 0, 1).getTime() &&
    new Date(widget.settings.targetAt).getTime() ===
      new Date(start.getFullYear() + 1, 0, 1).getTime()

  return isCalendarYear
    ? { ...widget, settings: { ...widget.settings, repeat: "yearly" } }
    : widget
}

const normalizeWidget = ({ archived, ...widget }: Widget): Widget =>
  ({
    ...widget,
    title: text(widget.title),
    colorPreset: COLOR_PRESETS.some((preset) => preset.id === widget.colorPreset)
      ? widget.colorPreset
      : COLOR_PRESETS[0]!.id,
    ...(archived === true ? { archived } : {}),
    settings: normalizeWidgetSettings(
      widget.kind,
      widget.settings as unknown as StoredSettings
    )
  }) as Widget

// A widget whose id repeats one already seen is dropped: the board keys cards and routes edits by id, so a second card under the same one would render twice and take the first one's edits.
const uniqueIds = (widgets: StoredWidget[]): StoredWidget[] => {
  const seen = new Set<string>()

  return widgets.filter((widget) => {
    if (seen.has(widget.id)) {
      return false
    }

    seen.add(widget.id)
    return true
  })
}

// A kind this build doesn't know is a card a newer Dayboard made on another synced device, not junk.
// It stays off the board, since there is nothing here that can draw it, but it is set aside with its place in the list rather than dropped: the whole board is written back on every save, so dropping it would delete it from every device the first time this one saved anything.
const normalizeState = (value: unknown): DayboardState => {
  if (!hasWidgets(value)) {
    return createDefaultState()
  }

  const widgets: Widget[] = []
  const unknownWidgets: UnknownWidget[] = []

  uniqueIds(value.widgets.filter(isWidgetShaped)).forEach((widget, index) => {
    if (isKnownWidget(widget)) {
      widgets.push(renewFirstRunYear(normalizeWidget(widget)))
    } else {
      unknownWidgets.push({ index, widget })
    }
  })

  return {
    widgets,
    settings: normalizeSettings((value as { settings?: unknown }).settings),
    ...(unknownWidgets.length > 0 ? { unknownWidgets } : {})
  }
}

// The board as storage and an exported file hold it: one list of cards, with any this build can't show put back where they were.
// The places are where they stood when last read, so once the board around them has changed they are near where they were rather than exact, which is all a card this build never shows needs.
const toStoredState = ({ unknownWidgets, ...state }: DayboardState) => {
  if (!unknownWidgets) {
    return state
  }

  const widgets: (Widget | StoredWidget)[] = [...state.widgets]
  unknownWidgets.forEach(({ index, widget }) => widgets.splice(index, 0, widget))

  return { ...state, widgets }
}

// Structural equality over plain JSON data, blind to key order, which differs between a widget built in the page and the same widget read back out of storage.
export const isSameData = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true
  }

  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false
  }

  const aKeys = Object.keys(a).filter((key) => (a as StoredSettings)[key] !== undefined)
  const bKeys = Object.keys(b).filter((key) => (b as StoredSettings)[key] !== undefined)

  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) =>
      isSameData((a as StoredSettings)[key], (b as StoredSettings)[key])
    )
  )
}

// Every read and every storage change arrives as a freshly parsed board, so taken as-is it hands each card a new widget object and every memoized card re-renders, including on the echo of a write this tab just made.
// Keep the objects that did not change, and the whole previous board when nothing did, so a change only renders the cards it touched and an echo renders nothing.
export const shareUnchanged = (
  previous: DayboardState | null,
  next: DayboardState
): DayboardState => {
  if (!previous) {
    return next
  }

  const byId = new Map(previous.widgets.map((widget) => [widget.id, widget]))
  const widgets = next.widgets.map((widget) => {
    const existing = byId.get(widget.id)

    return existing && isSameData(existing, widget) ? existing : widget
  })
  const settings = isSameData(previous.settings, next.settings)
    ? previous.settings
    : next.settings
  // A card only a newer build can show still changes when that build edits it, and this tab has to take the change, or its next save would put the old card back.
  const unknownWidgets = isSameData(previous.unknownWidgets, next.unknownWidgets)
    ? previous.unknownWidgets
    : next.unknownWidgets

  const isUnchanged =
    settings === previous.settings &&
    unknownWidgets === previous.unknownWidgets &&
    widgets.length === previous.widgets.length &&
    widgets.every((widget, index) => widget === previous.widgets[index])

  return isUnchanged
    ? previous
    : { widgets, settings, ...(unknownWidgets ? { unknownWidgets } : {}) }
}

// chrome.storage.sync reads are async IPC, so every new tab would open blank for a few frames while waiting on them.
// Mirroring the last-known board into localStorage lets the first render hydrate synchronously; the authoritative sync read then reconciles anything that changed on another device.
const cacheDayboardState = (state: DayboardState) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(toStoredState(state)))
  } catch {
    // Best effort: an unavailable or full localStorage only costs speed.
  }
}

export const readCachedDayboardState = (): DayboardState | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)

    return cached === null ? null : normalizeState(JSON.parse(cached))
  } catch {
    return null
  }
}

export const readDayboardState = async (): Promise<DayboardState> => {
  const result = await chrome.storage.sync.get(STORAGE_KEY)
  const state = normalizeState(result[STORAGE_KEY])

  cacheDayboardState(state)

  return state
}

// Pretty-printed JSON for the Export option.
export const serializeDayboardState = (state: DayboardState): string =>
  JSON.stringify(toStoredState(state), null, 2)

const NOT_A_BOARD = "That file is not a Dayboard board."

// Parse an exported file back into state for the Import option.
// Throws on invalid JSON or a payload that is not a board, so callers can reject the file rather than silently replacing the board with defaults.
export const parseDayboardState = (text: string): DayboardState => {
  // The Options dialog shows this message as it is, so a file that isn't even JSON gets the same plain answer rather than the parser's position report.
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(NOT_A_BOARD)
  }

  if (!hasWidgets(parsed)) {
    throw new Error(NOT_A_BOARD)
  }

  // A file is one the user chose to bring in, often by hand, so a kind this build doesn't know there is likelier a typo than a card from a newer build.
  // It is dropped as junk, as it always was, rather than kept somewhere nobody could see or remove it; only a synced board carries such cards, since there a newer device is still using them.
  const { unknownWidgets: _unshown, ...board } = normalizeState(parsed)

  return board
}

export const writeDayboardState = async (
  state: DayboardState
): Promise<void> => {
  await chrome.storage.sync.set({ [STORAGE_KEY]: toStoredState(state) })
  cacheDayboardState(state)
}

export const watchDayboardState = (
  listener: (state: DayboardState) => void
): (() => void) => {
  const handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== "sync") {
      return
    }

    const change = changes[STORAGE_KEY]
    if (!change) {
      return
    }

    const state = normalizeState(change.newValue)

    cacheDayboardState(state)
    listener(state)
  }

  chrome.storage.onChanged.addListener(handleStorageChange)

  return () => chrome.storage.onChanged.removeListener(handleStorageChange)
}
