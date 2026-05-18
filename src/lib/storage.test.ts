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

  it("migrates v1 items into v2 widgets and drops legacy settings", async () => {
    const { migrateClockboardState } = await import("./storage")
    const migrated = migrateClockboardState({
      version: 1,
      settings: {
        boardTitle: "My board",
        showDate: false
      },
      items: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Paris",
          timeZone: "Europe/Paris",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        },
        {
          id: "countdown-1",
          kind: "countdown",
          title: "Launch",
          timeZone: "America/New_York",
          targetDateTime: "2026-01-01T09:30",
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-04T00:00:00.000Z"
        }
      ]
    })

    expect(migrated).toEqual({
      version: 2,
      widgets: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Paris",
          placement: "main",
          settings: {
            timeZone: "Europe/Paris"
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        },
        {
          id: "countdown-1",
          kind: "countdown",
          title: "Launch",
          placement: "main",
          settings: {
            targetAt: "2026-01-01T14:30:00.000Z"
          },
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-04T00:00:00.000Z"
        }
      ]
    })
    expect(migrated).not.toHaveProperty("settings")
    expect(migrated.widgets[1]?.settings).not.toHaveProperty("timeZone")
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
      settings: {
        timeZone: expect.any(String)
      }
    })
    expect(migrated.widgets[1]).toMatchObject({
      id: "countdown-1",
      kind: "countdown",
      placement: "more",
      title: "Countdown",
      settings: {
        targetAt: expect.stringMatching(/Z$/)
      }
    })
    expect(migrated).not.toHaveProperty("settings")
  })

  it("moves existing extension data from local storage into sync storage", async () => {
    const syncedStorageArea = createMockStorageArea()
    const legacyStorageArea = createMockStorageArea({
      [STORAGE_KEY]: JSON.stringify({
        version: 2,
        widgets: [
          {
            id: "clock-1",
            kind: "clock",
            title: "Paris",
            placement: "main",
            settings: {
              timeZone: "Europe/Paris"
            },
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z"
          }
        ]
      })
    })

    vi.stubGlobal("chrome", {
      storage: {
        sync: syncedStorageArea,
        local: legacyStorageArea,
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      }
    })

    const { readClockboardState } = await import("./storage")
    const state = await readClockboardState()

    expect(state.widgets).toMatchObject([
      {
        id: "clock-1",
        title: "Paris"
      }
    ])
    expect(syncedStorageArea.values.get(STORAGE_KEY)).toBe(JSON.stringify(state))
    expect(legacyStorageArea.values.has(STORAGE_KEY)).toBe(false)
  })

  it("watches sync storage changes", async () => {
    const addListener = vi.fn()
    const removeListener = vi.fn()
    const syncedStorageArea = createMockStorageArea()
    const legacyStorageArea = createMockStorageArea()

    vi.stubGlobal("chrome", {
      storage: {
        sync: syncedStorageArea,
        local: legacyStorageArea,
        onChanged: {
          addListener,
          removeListener
        }
      }
    })

    const { watchClockboardState } = await import("./storage")
    const handleChange = vi.fn()
    const stopWatching = watchClockboardState(handleChange)
    const listener = addListener.mock.calls[0]?.[0]

    expect(listener).toBeTypeOf("function")

    listener?.(
      {
        [STORAGE_KEY]: {
          newValue: JSON.stringify({
            version: 2,
            widgets: [
              {
                id: "clock-1",
                kind: "clock",
                title: "Tokyo",
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

    expect(removeListener).toHaveBeenCalledWith(listener)
  })
})
