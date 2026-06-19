import {
  BOARD_COLUMN_CHOICES,
  DEFAULT_SETTINGS,
  createDefaultState,
  type ClockboardSettings,
  type ClockboardState
} from "./types"

export const STORAGE_KEY = "clockboard-state"

const hasWidgets = (value: unknown): value is { widgets: unknown[] } =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { widgets?: unknown }).widgets)

// Settings were added after the first widgets shipped, so fill any missing or
// malformed fields with their defaults rather than discarding the whole board.
const normalizeSettings = (value: unknown): ClockboardSettings => {
  const stored = (typeof value === "object" && value !== null
    ? value
    : {}) as Partial<ClockboardSettings>

  return {
    dragToMove:
      typeof stored.dragToMove === "boolean"
        ? stored.dragToMove
        : DEFAULT_SETTINGS.dragToMove,
    columns: BOARD_COLUMN_CHOICES.includes(stored.columns as never)
      ? (stored.columns as ClockboardSettings["columns"])
      : DEFAULT_SETTINGS.columns,
    name: typeof stored.name === "string" ? stored.name : DEFAULT_SETTINGS.name,
    chimeOnTimerEnd:
      typeof stored.chimeOnTimerEnd === "boolean"
        ? stored.chimeOnTimerEnd
        : DEFAULT_SETTINGS.chimeOnTimerEnd
  }
}

const normalizeState = (value: unknown): ClockboardState => {
  if (!hasWidgets(value)) {
    return createDefaultState()
  }

  return {
    widgets: (value as ClockboardState).widgets,
    settings: normalizeSettings((value as { settings?: unknown }).settings)
  }
}

export const readClockboardState = async (): Promise<ClockboardState> => {
  const result = await chrome.storage.sync.get(STORAGE_KEY)

  return normalizeState(result[STORAGE_KEY])
}

// Pretty-printed JSON for the Export option.
export const serializeClockboardState = (state: ClockboardState): string =>
  JSON.stringify(state, null, 2)

// Parse an exported file back into state for the Import option. Throws on
// invalid JSON or a payload that is not a board, so callers can reject the file
// rather than silently replacing the board with defaults.
export const parseClockboardState = (text: string): ClockboardState => {
  const parsed: unknown = JSON.parse(text)

  if (!hasWidgets(parsed)) {
    throw new Error("That file is not a Clockboard board.")
  }

  return normalizeState(parsed)
}

export const writeClockboardState = async (
  state: ClockboardState
): Promise<void> => {
  await chrome.storage.sync.set({ [STORAGE_KEY]: state })
}

export const watchClockboardState = (
  listener: (state: ClockboardState) => void
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
