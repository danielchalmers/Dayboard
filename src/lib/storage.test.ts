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
    const invalidState = migrateClockboardState({ version: 2, widgets: [] })

    expect(missingState.version).toBe(2)
    expect(missingState.widgets).toHaveLength(2)
    expect(missingState.widgets.map((widget) => widget.kind)).toEqual([
      "clock",
      "countdown"
    ])
    expect(invalidState.widgets).toHaveLength(2)
  })

  it("drops unsupported legacy state shapes", async () => {
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

    expect(migrated.version).toBe(2)
    expect(migrated.widgets).toHaveLength(2)
    expect(migrated.widgets.map((widget) => widget.kind)).toEqual([
      "clock",
      "countdown"
    ])
  })

  it("sanitizes existing v2 widgets", async () => {
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
          color: "#4f7cff",
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
          color: "violet",
          placement: "more",
          settings: {
            targetAt: "not-an-instant"
          },
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-04T00:00:00.000Z"
        }
      ]
    })

    expect(migrated.version).toBe(2)
    expect(migrated.widgets[0]).toMatchObject({
      id: "clock-1",
      kind: "clock",
      placement: "main",
      title: "Clock",
      color: "#4f7cff",
      settings: {
        timeZone: expect.any(String)
      }
    })
    expect(migrated.widgets[1]).toMatchObject({
      id: "countdown-1",
      kind: "countdown",
      placement: "more",
      title: "Countdown",
      color: null,
      settings: {
        targetAt: expect.stringMatching(/Z$/)
      }
    })
    expect(migrated).not.toHaveProperty("settings")
  })
})

describe("watchClockboardState", () => {
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
            version: 2,
            widgets: [
              {
                id: "clock-1",
                kind: "clock",
                title: "Tokyo",
                color: "#8b5cf6",
                placement: "main",
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
      version: 2,
      widgets: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Tokyo",
          color: "#8b5cf6",
          placement: "main",
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
