import { Storage, type StorageCallbackMap } from "@plasmohq/storage"

import {
  createDefaultState,
  DEFAULT_TIME_ZONE,
  DEFAULT_WIDGET_PLACEMENT,
  type ClockboardState,
  type ClockWidget,
  type CountdownWidget,
  type Widget,
  type WidgetPlacement
} from "./types"

export const STORAGE_KEY = "clockboard-state"

const syncedStorage = new Storage({
  area: "sync"
})

const hasSyncedExtensionStorage = (): boolean =>
  typeof chrome !== "undefined" && Boolean(chrome.storage?.sync)

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

const asPlacement = (
  value: unknown,
  fallback: WidgetPlacement = DEFAULT_WIDGET_PLACEMENT
): WidgetPlacement => (value === "main" || value === "more" ? value : fallback)

const sanitizeIsoInstant = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

const sanitizeWidgetBase = (value: Record<string, unknown>) => {
  const now = new Date().toISOString()

  return {
    id: asString(value.id, crypto.randomUUID()),
    title: asString(value.title, "Untitled"),
    placement: asPlacement(value.placement),
    createdAt: asString(value.createdAt, now),
    updatedAt: asString(value.updatedAt, now)
  }
}

const sanitizeClockWidget = (value: unknown): ClockWidget | null => {
  if (!isRecord(value)) {
    return null
  }

  const settings = isRecord(value.settings) ? value.settings : {}

  return {
    ...sanitizeWidgetBase(value),
    kind: "clock",
    settings: {
      timeZone: asString(settings.timeZone, DEFAULT_TIME_ZONE)
    }
  }
}

const sanitizeCountdownWidget = (value: unknown): CountdownWidget | null => {
  if (!isRecord(value)) {
    return null
  }

  const settings = isRecord(value.settings) ? value.settings : {}
  const fallbackTargetAt = createDefaultState().widgets.find(
    (widget): widget is CountdownWidget => widget.kind === "countdown"
  )!.settings.targetAt

  return {
    ...sanitizeWidgetBase(value),
    kind: "countdown",
    settings: {
      targetAt: sanitizeIsoInstant(settings.targetAt, fallbackTargetAt)
    }
  }
}

const sanitizeWidget = (value: unknown): Widget | null => {
  if (!isRecord(value)) {
    return null
  }

  if (value.kind === "clock") {
    return sanitizeClockWidget(value)
  }

  if (value.kind === "countdown") {
    return sanitizeCountdownWidget(value)
  }

  return null
}

const sanitizeWidgets = (value: unknown): Widget[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((widget) => sanitizeWidget(widget))
    .filter((widget): widget is Widget => widget !== null)
}

export const sanitizeClockboardState = (value: unknown): ClockboardState => {
  if (!isRecord(value)) {
    return createDefaultState()
  }

  const widgets = sanitizeWidgets(value.widgets)

  return {
    widgets: widgets.length > 0 ? widgets : createDefaultState().widgets
  }
}

export const readClockboardState = async (): Promise<ClockboardState> => {
  const value = hasSyncedExtensionStorage()
    ? await syncedStorage.get<unknown>(STORAGE_KEY)
    : readFallbackStorage()

  return sanitizeClockboardState(value)
}

export const writeClockboardState = async (
  state: ClockboardState
): Promise<void> => {
  if (hasSyncedExtensionStorage()) {
    await syncedStorage.set(STORAGE_KEY, state)
    return
  }

  writeFallbackStorage(state)
}

export const watchClockboardState = (
  listener: (state: ClockboardState) => void
): (() => void) => {
  const callbackMap: StorageCallbackMap = {
    [STORAGE_KEY]: (change) => {
      listener(sanitizeClockboardState(change.newValue))
    }
  }

  syncedStorage.watch(callbackMap)

  return () => syncedStorage.unwatch(callbackMap)
}

export const updateClockboardState = async (
  updater: (state: ClockboardState) => ClockboardState
): Promise<ClockboardState> => {
  const nextState = updater(await readClockboardState())
  await writeClockboardState(nextState)
  return nextState
}
