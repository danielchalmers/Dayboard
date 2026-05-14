import { Storage } from "@plasmohq/storage"

import {
  createDefaultState,
  DEFAULT_SETTINGS,
  DEFAULT_TIME_ZONE,
  type BoardDensity,
  type BoardItem,
  type BoardLayout,
  type BoardDetailLevel,
  type ClockPrecision,
  type ClockboardSettings,
  type ClockboardState
} from "./types"

export const STORAGE_KEY = "clockboard-state"

const storage = new Storage({
  area: "local"
})

const hasExtensionStorage = (): boolean =>
  typeof chrome !== "undefined" && Boolean(chrome.storage?.local)

const readFallbackStorage = (): unknown => {
  if (typeof localStorage === "undefined") {
    return undefined
  }

  const rawValue = localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return undefined
  }

  try {
    return JSON.parse(rawValue)
  } catch {
    return undefined
  }
}

const writeFallbackStorage = (state: ClockboardState): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const asString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback

const asChoice = <T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T
): T => (choices.includes(value as T) ? (value as T) : fallback)

const sanitizeSettings = (value: unknown): ClockboardSettings => {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS
  }

  return {
    boardTitle: asString(value.boardTitle, DEFAULT_SETTINGS.boardTitle),
    showDate: asBoolean(value.showDate, DEFAULT_SETTINGS.showDate),
    layout: asChoice<BoardLayout>(
      value.layout,
      ["focus", "grid", "compact"],
      DEFAULT_SETTINGS.layout
    ),
    density: asChoice<BoardDensity>(
      value.density,
      ["comfortable", "condensed"],
      DEFAULT_SETTINGS.density
    ),
    detailLevel: asChoice<BoardDetailLevel>(
      value.detailLevel,
      ["minimal", "balanced", "rich"],
      DEFAULT_SETTINGS.detailLevel
    ),
    clockPrecision: asChoice<ClockPrecision>(
      value.clockPrecision,
      ["minutes", "seconds"],
      DEFAULT_SETTINGS.clockPrecision
    )
  }
}

const sanitizeItem = (value: unknown): BoardItem | null => {
  if (!isRecord(value)) {
    return null
  }

  const now = new Date().toISOString()
  const base = {
    id: asString(value.id, crypto.randomUUID()),
    title: asString(value.title, "Untitled"),
    timeZone: asString(value.timeZone, DEFAULT_TIME_ZONE),
    createdAt: asString(value.createdAt, now),
    updatedAt: asString(value.updatedAt, now)
  }

  if (value.kind === "clock") {
    return {
      ...base,
      kind: "clock"
    }
  }

  if (value.kind === "countdown") {
    return {
      ...base,
      kind: "countdown",
      targetDateTime: asString(value.targetDateTime, "2026-01-01T00:00")
    }
  }

  return null
}

export const migrateClockboardState = (value: unknown): ClockboardState => {
  if (!isRecord(value)) {
    return createDefaultState()
  }

  const rawItems = Array.isArray(value.items) ? value.items : []
  const items = rawItems
    .map((item) => sanitizeItem(item))
    .filter((item): item is BoardItem => item !== null)

  return {
    version: 2,
    settings: sanitizeSettings(value.settings),
    items: items.length > 0 ? items : createDefaultState().items
  }
}

export const readClockboardState = async (): Promise<ClockboardState> => {
  const value = hasExtensionStorage()
    ? await storage.get<unknown>(STORAGE_KEY)
    : readFallbackStorage()

  return migrateClockboardState(value)
}

export const writeClockboardState = async (
  state: ClockboardState
): Promise<void> => {
  if (hasExtensionStorage()) {
    await storage.set(STORAGE_KEY, state)
    return
  }

  writeFallbackStorage(state)
}

export const updateClockboardState = async (
  updater: (state: ClockboardState) => ClockboardState
): Promise<ClockboardState> => {
  const nextState = updater(await readClockboardState())
  await writeClockboardState(nextState)
  return nextState
}
