import { afterEach, describe, expect, it, vi } from "vitest"

const STORAGE_KEY = "clockboard-state"

const createMockStorageArea = (initialValues: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initialValues))

  return {
    values,
    get: vi.fn(async (keys?: string | string[]) => {
      if (typeof keys === "undefined") {
        return Object.fromEntries(values)
      }

      const keyList = Array.isArray(keys) ? keys : [keys]
      return Object.fromEntries(keyList.map((key) => [key, values.get(key)]))
    }),
    set: vi.fn(async (items: Record<string, string>) => {
      Object.entries(items).forEach(([key, value]) => {
        values.set(key, value)
      })
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      ;(Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        values.delete(key)
      })
    }),
    clear: vi.fn(async () => {
      values.clear()
    })
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("migrateClockboardState", () => {
  it("falls back to default widgets for missing or invalid state", async () => {
    const { migrateClockboardState } = await import("./storage")
    const missingState = migrateClockboardState(undefined)
    const invalidState = migrateClockboardState({ version: 3, widgets: [] })

    expect(missingState.version).toBe(3)
    expect(missingState.widgets).toHaveLength(2)
    expect(missingState.widgets.map((widget) => widget.kind)).toEqual([
      "clock",
      "countdown"
    ])
    expect(invalidState.widgets).toHaveLength(2)
  })

  it("drops unsupported legacy version 1 state shapes", async () => {
    const { migrateClockboardState } = await import("./storage")
    const migrated = migrateClockboardState({
      version: 1,
      items: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Paris",
          timeZone: "Europe/Paris"
        }
      ]
    })

    expect(migrated.version).toBe(3)
    expect(migrated.widgets).toHaveLength(2)
    expect(migrated.widgets.map((widget) => widget.kind)).toEqual([
      "clock",
      "countdown"
    ])
  })

  it("migrates and sanitizes existing version 2 widgets, applying colorPreset", async () => {
    const { migrateClockboardState } = await import("./storage")
    const migrated = migrateClockboardState({
      version: 2,
      settings: {
        boardTitle: "Legacy",
        showDate: true
      },
      widgets: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Clock",
          placement: "somewhere",
          settings: {
            timeZone: ""
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        },
        {
          id: "countdown-1",
          kind: "countdown",
          title: "Countdown",
          placement: "more",
          colorPreset: "invalid-color-preset-so-should-fallback",
          settings: {
            targetAt: "not-an-instant"
          },
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-04T00:00:00.000Z"
        }
      ]
    })

    expect(migrated.version).toBe(3)
    expect(migrated.widgets[0]).toMatchObject({
      id: "clock-1",
      kind: "clock",
      placement: "main",
      colorPreset: "slate", // default color preset applied
      title: "Clock",
      settings: {
        timeZone: expect.any(String)
      }
    })
    expect(migrated.widgets[1]).toMatchObject({
      id: "countdown-1",
      kind: "countdown",
      placement: "more",
      colorPreset: "slate", // invalid color preset sanitized to slate
      title: "Countdown",
      settings: {
        targetAt: expect.stringMatching(/Z$/)
      }
    })
    expect(migrated).not.toHaveProperty("settings")
  })
})

describe("watchClockboardState", () => {
  it("watches fallback storage changes", async () => {
    const { watchClockboardState } = await import("./storage")
    const handleChange = vi.fn()
    const stopWatching = watchClockboardState(handleChange)

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: JSON.stringify({
          version: 3,
          widgets: [
            {
              id: "clock-1",
              kind: "clock",
              title: "Tokyo",
              placement: "main",
              colorPreset: "rose",
              settings: {
                timeZone: "Asia/Tokyo"
              },
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z"
            }
          ]
        })
      })
    )

    expect(handleChange).toHaveBeenCalledWith({
      version: 3,
      widgets: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Tokyo",
          placement: "main",
          colorPreset: "rose",
          settings: {
            timeZone: "Asia/Tokyo"
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        }
      ]
    })

    stopWatching()
    handleChange.mockClear()

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: null
      })
    )

    expect(handleChange).not.toHaveBeenCalled()
  })

  it("watches sync storage changes", async () => {
    const addListener = vi.fn()
    const mockRemoveListener = vi.fn()
    const syncedStorageArea = createMockStorageArea()

    vi.stubGlobal("chrome", {
      storage: {
        sync: syncedStorageArea,
        onChanged: {
          addListener,
          removeListener: mockRemoveListener
        }
      }
    })

    const { watchClockboardState } = await import("./storage")
    const handleChange = vi.fn()
    const stopWatching = watchClockboardState(handleChange)
    const storageChangeListener = addListener.mock.calls[0]?.[0]

    expect(storageChangeListener).toBeTypeOf("function")

    storageChangeListener?.(
      {
        [STORAGE_KEY]: {
          newValue: JSON.stringify({
            version: 3,
            widgets: [
              {
                id: "clock-1",
                kind: "clock",
                title: "Tokyo",
                placement: "main",
                colorPreset: "teal",
                settings: {
                  timeZone: "Asia/Tokyo"
                },
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z"
              }
            ]
          }),
          oldValue: undefined
        }
      },
      "sync"
    )

    await vi.waitFor(() => {
      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    expect(handleChange).toHaveBeenCalledWith({
      version: 3,
      widgets: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Tokyo",
          placement: "main",
          colorPreset: "teal",
          settings: {
            timeZone: "Asia/Tokyo"
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        }
      ]
    })

    stopWatching()

    expect(mockRemoveListener).toHaveBeenCalledWith(storageChangeListener)
  })
})
