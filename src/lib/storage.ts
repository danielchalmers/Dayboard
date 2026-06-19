import {
  BOARD_COLUMN_CHOICES,
  DEFAULT_SETTINGS,
  createDefaultState,
  type DayboardSettings,
  type DayboardState,
  type Widget
} from "./types"
import { widgetRegistry } from "./widgets"

export const STORAGE_KEY = "dayboard-state"
// The app was renamed from Clockboard; boards saved before the rename live under
// the old key and are migrated to STORAGE_KEY the first time they are read.
const LEGACY_STORAGE_KEY = "clockboard-state"

const hasWidgets = (value: unknown): value is { widgets: unknown[] } =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { widgets?: unknown }).widgets)

// Keep only entries that look like widgets of a known kind, so a hand-edited or
// imported file with junk rows renders the valid widgets instead of blank cards.
const isValidWidget = (value: unknown): value is Widget =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Widget).id === "string" &&
  (value as Widget).kind in widgetRegistry

// Settings were added after the first widgets shipped, so fill any missing or
// malformed fields with their defaults rather than discarding the whole board.
const normalizeSettings = (value: unknown): DayboardSettings => {
  const stored = (typeof value === "object" && value !== null
    ? value
    : {}) as Partial<DayboardSettings>

  return {
    dragToMove:
      typeof stored.dragToMove === "boolean"
        ? stored.dragToMove
        : DEFAULT_SETTINGS.dragToMove,
    columns: BOARD_COLUMN_CHOICES.includes(stored.columns as never)
      ? (stored.columns as DayboardSettings["columns"])
      : DEFAULT_SETTINGS.columns,
    name: typeof stored.name === "string" ? stored.name : DEFAULT_SETTINGS.name,
    chimeOnTimerEnd:
      typeof stored.chimeOnTimerEnd === "boolean"
        ? stored.chimeOnTimerEnd
        : DEFAULT_SETTINGS.chimeOnTimerEnd
  }
}

const normalizeState = (value: unknown): DayboardState => {
  if (!hasWidgets(value)) {
    return createDefaultState()
  }

  return {
    widgets: value.widgets.filter(isValidWidget),
    settings: normalizeSettings((value as { settings?: unknown }).settings)
  }
}

export const readDayboardState = async (): Promise<DayboardState> => {
  const result = await chrome.storage.sync.get([STORAGE_KEY, LEGACY_STORAGE_KEY])

  if (result[STORAGE_KEY] !== undefined) {
    return normalizeState(result[STORAGE_KEY])
  }

  // First read after the rename: adopt the board saved under the old key, move
  // it to the new key, and drop the old one. Best-effort so a write failure
  // still returns the board.
  if (result[LEGACY_STORAGE_KEY] !== undefined) {
    const migrated = normalizeState(result[LEGACY_STORAGE_KEY])

    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: migrated })
      await chrome.storage.sync.remove(LEGACY_STORAGE_KEY)
    } catch {
      // Leave the legacy key in place; we'll try again on the next read.
    }

    return migrated
  }

  return createDefaultState()
}

// Pretty-printed JSON for the Export option.
export const serializeDayboardState = (state: DayboardState): string =>
  JSON.stringify(state, null, 2)

// Parse an exported file back into state for the Import option. Throws on
// invalid JSON or a payload that is not a board, so callers can reject the file
// rather than silently replacing the board with defaults.
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

    listener(normalizeState(change.newValue))
  }

  chrome.storage.onChanged.addListener(handleStorageChange)

  return () => chrome.storage.onChanged.removeListener(handleStorageChange)
}
