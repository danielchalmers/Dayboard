import { createDefaultState, type ClockboardState } from "./types"

export const STORAGE_KEY = "clockboard-state"

const isClockboardState = (value: unknown): value is ClockboardState =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { widgets?: unknown }).widgets)

export const readClockboardState = async (): Promise<ClockboardState> => {
  const result = await chrome.storage.sync.get(STORAGE_KEY)
  const stored = result[STORAGE_KEY]

  return isClockboardState(stored) ? stored : createDefaultState()
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

    listener(
      isClockboardState(change.newValue) ? change.newValue : createDefaultState()
    )
  }

  chrome.storage.onChanged.addListener(handleStorageChange)

  return () => chrome.storage.onChanged.removeListener(handleStorageChange)
}
