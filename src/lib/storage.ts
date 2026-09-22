import { COLOR_PRESETS } from "./colors"
import {
  DEFAULT_SETTINGS,
  createDefaultState,
  type CountdownRepeat,
  type CountdownWidget,
  type DayboardSettings,
  type DayboardState,
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

// Keep only entries that look like widgets of a known kind, so a hand-edited or imported file with junk rows renders the valid widgets instead of blank cards.
// A settings object has to be among them: normalization and the cards both read straight through it, so an entry missing one throws on the way in and takes the whole board with it rather than being dropped like the rest of the junk.
const isValidWidget = (value: unknown): value is Widget =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Widget).id === "string" &&
  // An own key, not `in`: the registry is a plain object, so `in` also lets through kinds such as "toString" off its prototype.
  Object.hasOwn(widgetRegistry, (value as Widget).kind) &&
  typeof (value as Widget).settings === "object" &&
  (value as Widget).settings !== null

// Fill any missing or malformed fields with their defaults so a partial or hand-edited imported board still loads cleanly.
const normalizeSettings = (value: unknown): DayboardSettings => {
  const stored = (typeof value === "object" && value !== null
    ? value
    : {}) as Partial<DayboardSettings>

  return {
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
      return { history: normalizeHistory(settings.history) }
    case "todo":
      return { tasks: normalizeTasks(settings.tasks) }
  }
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
const uniqueIds = (widgets: Widget[]): Widget[] => {
  const seen = new Set<string>()

  return widgets.filter((widget) => {
    if (seen.has(widget.id)) {
      return false
    }

    seen.add(widget.id)
    return true
  })
}

const normalizeState = (value: unknown): DayboardState => {
  if (!hasWidgets(value)) {
    return createDefaultState()
  }

  return {
    widgets: uniqueIds(value.widgets.filter(isValidWidget)).map(normalizeWidget),
    settings: normalizeSettings((value as { settings?: unknown }).settings)
  }
}

// chrome.storage.sync reads are async IPC, so every new tab would open blank for a few frames while waiting on them.
// Mirroring the last-known board into localStorage lets the first render hydrate synchronously; the authoritative sync read then reconciles anything that changed on another device.
const cacheDayboardState = (state: DayboardState) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state))
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
  JSON.stringify(state, null, 2)

// Parse an exported file back into state for the Import option.
// Throws on invalid JSON or a payload that is not a board, so callers can reject the file rather than silently replacing the board with defaults.
export const parseDayboardState = (text: string): DayboardState => {
  const parsed: unknown = JSON.parse(text)

  if (!hasWidgets(parsed)) {
    throw new Error("That file is not a Dayboard board.")
  }

  return normalizeState(parsed)
}

export const writeDayboardState = async (
  state: DayboardState
): Promise<void> => {
  await chrome.storage.sync.set({ [STORAGE_KEY]: state })
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
