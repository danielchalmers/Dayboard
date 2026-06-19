import { afterEach, describe, expect, it, vi } from "vitest"

import type { ClockboardState } from "./types"

const STORAGE_KEY = "clockboard-state"

const sampleState: ClockboardState = {
  widgets: [
    {
      id: "clock-1",
      kind: "clock",
      title: "Tokyo",
      colorPreset: "teal",
      settings: {
        timeZone: "Asia/Tokyo"
      }
    }
  ],
  settings: {
    dragToMove: true,
    columns: "auto",
    name: ""
  }
}

const stubChromeStorage = () => {
  const store = new Map<string, unknown>()
  const addListener = vi.fn()
  const removeListener = vi.fn()

  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.entries(items).forEach(([key, value]) => store.set(key, value))
        })
      },
      onChanged: {
        addListener,
        removeListener
      }
    }
  })

  return { store, addListener, removeListener }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("readClockboardState", () => {
  it("returns the default widgets when nothing is stored", async () => {
    stubChromeStorage()

    const { readClockboardState } = await import("./storage")
    const state = await readClockboardState()

    expect(state.widgets.map((widget) => widget.kind)).toEqual([
      "clock",
      "countdown"
    ])
  })

  it("returns the stored state when present", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, sampleState)

    const { readClockboardState } = await import("./storage")

    expect(await readClockboardState()).toEqual(sampleState)
  })

  it("falls back to defaults when the stored value is malformed", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, "not-an-object")

    const { readClockboardState } = await import("./storage")
    const state = await readClockboardState()

    expect(state.widgets).toHaveLength(2)
    expect(state.settings).toEqual({ dragToMove: true, columns: "auto", name: "" })
  })

  it("fills in default settings for state stored before settings existed", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, { widgets: sampleState.widgets })

    const { readClockboardState } = await import("./storage")
    const state = await readClockboardState()

    expect(state.widgets).toEqual(sampleState.widgets)
    expect(state.settings).toEqual({ dragToMove: true, columns: "auto", name: "" })
  })

  it("sanitizes malformed settings fields back to their defaults", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, {
      widgets: sampleState.widgets,
      settings: { dragToMove: "nope", columns: 7 }
    })

    const { readClockboardState } = await import("./storage")
    const state = await readClockboardState()

    expect(state.settings).toEqual({ dragToMove: true, columns: "auto", name: "" })
  })
})

describe("writeClockboardState", () => {
  it("stores the state object under the storage key", async () => {
    const { store } = stubChromeStorage()

    const { writeClockboardState } = await import("./storage")
    await writeClockboardState(sampleState)

    expect(store.get(STORAGE_KEY)).toEqual(sampleState)
  })
})

describe("watchClockboardState", () => {
  it("notifies on sync changes and unsubscribes on stop", async () => {
    const { addListener, removeListener } = stubChromeStorage()

    const { watchClockboardState } = await import("./storage")
    const handleChange = vi.fn()
    const stopWatching = watchClockboardState(handleChange)

    const listener = addListener.mock.calls[0]?.[0]
    expect(listener).toBeTypeOf("function")

    listener?.({ [STORAGE_KEY]: { newValue: sampleState } }, "sync")
    expect(handleChange).toHaveBeenCalledWith(sampleState)

    handleChange.mockClear()
    listener?.({ [STORAGE_KEY]: { newValue: sampleState } }, "local")
    expect(handleChange).not.toHaveBeenCalled()

    stopWatching()
    expect(removeListener).toHaveBeenCalledWith(listener)
  })
})
