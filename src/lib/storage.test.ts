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

describe("sanitizeClockboardState", () => {
  it("falls back to default widgets for missing or invalid state", async () => {
    const { sanitizeClockboardState } = await import("./storage")
    const missingState = sanitizeClockboardState(undefined)
    const invalidState = sanitizeClockboardState({ widgets: [] })

    expect(missingState.widgets).toHaveLength(2)
    expect(missingState.widgets.map((widget) => widget.kind)).toEqual([
      "clock",
      "countdown"
    ])
    expect(invalidState.widgets).toHaveLength(2)
  })

  it("falls back to defaults for unsupported stored shapes", async () => {
    const { sanitizeClockboardState } = await import("./storage")
    const sanitized = sanitizeClockboardState({
      items: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Paris",
          timeZone: "Europe/Paris"
        }
      ]
    })

    expect(sanitized.widgets).toHaveLength(2)
    expect(sanitized.widgets.map((widget) => widget.kind)).toEqual([
      "clock",
      "countdown"
    ])
  })

  it("sanitizes stored widgets", async () => {
    const { sanitizeClockboardState } = await import("./storage")
    const sanitized = sanitizeClockboardState({
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

    expect(sanitized.widgets[0]).toMatchObject({
      id: "clock-1",
      kind: "clock",
      placement: "main",
      title: "Clock",
      settings: {
        timeZone: expect.any(String)
      }
    })
    expect(sanitized.widgets[1]).toMatchObject({
      id: "countdown-1",
      kind: "countdown",
      placement: "more",
      title: "Countdown",
      settings: {
        targetAt: expect.stringMatching(/Z$/)
      }
    })
    expect(sanitized).not.toHaveProperty("settings")
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

    expect(mockRemoveListener).toHaveBeenCalledWith(storageChangeListener)
  })
})
