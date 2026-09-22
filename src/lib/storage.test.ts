// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"

import { STORED_DAYS, toDayKey } from "./habit"
import type {
  CountdownWidget,
  DayboardState,
  HabitWidget,
  TodoWidget
} from "./types"

const STORAGE_KEY = "dayboard-state"

const sampleState: DayboardState = {
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
  localStorage.clear()
})

describe("readDayboardState", () => {
  it("returns the default widgets when nothing is stored", async () => {
    stubChromeStorage()

    const { readDayboardState } = await import("./storage")
    const state = await readDayboardState()

    expect(state.widgets.map((widget) => widget.kind)).toEqual([
      "clock",
      "countdown",
      "note",
      "quote",
      "habit",
      "countdown"
    ])
  })

  it("returns the stored state when present", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, sampleState)

    const { readDayboardState } = await import("./storage")

    expect(await readDayboardState()).toEqual(sampleState)
  })

  it("falls back to defaults when the stored value is malformed", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, "not-an-object")

    const { readDayboardState } = await import("./storage")
    const state = await readDayboardState()

    expect(state.widgets).toHaveLength(6)
    expect(state.settings).toEqual({ name: "" })
  })

  it("fills in default settings for state stored before settings existed", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, { widgets: sampleState.widgets })

    const { readDayboardState } = await import("./storage")
    const state = await readDayboardState()

    expect(state.widgets).toEqual(sampleState.widgets)
    expect(state.settings).toEqual({ name: "" })
  })

  it("drops malformed widget entries while keeping valid ones", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, {
      widgets: [
        sampleState.widgets[0],
        { id: "x", kind: "totally-unknown", settings: {} },
        { kind: "clock" },
        // A known kind with no settings is junk too: everything downstream reads through that object, so keeping the row would throw instead of rendering the rest of the board.
        { id: "no-settings-habit", kind: "habit" },
        "nonsense"
      ]
    })

    const { readDayboardState } = await import("./storage")
    const state = await readDayboardState()

    expect(state.widgets).toEqual(sampleState.widgets)
  })

  it("prunes a legacy unbounded habit history down to the visible week", async () => {
    // Ten months of daily completions, the shape old versions accumulated.
    const base = new Date(2026, 6, 9)
    const days = Array.from({ length: 300 }, (_, offset) => {
      const d = new Date(base)
      d.setDate(d.getDate() - offset)
      return toDayKey(d)
    })
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, {
      widgets: [
        {
          id: "habit-1",
          kind: "habit",
          title: "Read",
          colorPreset: "amber",
          settings: { history: days }
        }
      ]
    })

    const { readDayboardState } = await import("./storage")
    const state = await readDayboardState()

    const habit = state.widgets[0] as HabitWidget
    expect(habit.settings.history).toHaveLength(STORED_DAYS)
    expect(habit.settings.history).toContain("2026-07-09")
    expect(habit.settings.history).toContain("2026-07-03")
    expect(habit.settings.history).not.toContain("2026-07-02")
  })

  it("cleans up a todo list from an imported or hand-edited board", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, {
      widgets: [
        {
          id: "todo-1",
          kind: "todo",
          title: "Today",
          colorPreset: "mint",
          settings: {
            tasks: [{ id: "a", text: "  Buy milk  ", done: true }, "not a task"]
          }
        }
      ]
    })

    const { readDayboardState } = await import("./storage")
    const state = await readDayboardState()

    expect((state.widgets[0] as TodoWidget).settings.tasks).toEqual([
      { id: "a", text: "Buy milk", done: true }
    ])
  })

  it("retires a legacy countdown display setting", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, {
      widgets: [
        {
          id: "kept",
          kind: "countdown",
          title: "Year",
          colorPreset: "rose",
          settings: {
            targetAt: "2026-12-31T00:00:00.000Z",
            startAt: "2026-01-01T00:00:00.000Z",
            display: "progress"
          }
        },
        {
          id: "dropped",
          kind: "countdown",
          title: "Launch",
          colorPreset: "indigo",
          settings: {
            targetAt: "2026-12-31T00:00:00.000Z",
            startAt: "2026-01-01T00:00:00.000Z",
            display: "text"
          }
        }
      ]
    })

    const { readDayboardState } = await import("./storage")
    const state = await readDayboardState()
    const [kept, dropped] = state.widgets as CountdownWidget[]

    // The old key goes either way; a card that was showing text keeps showing it rather than turning into a bar it never had.
    expect(kept!.settings).toEqual({
      targetAt: "2026-12-31T00:00:00.000Z",
      startAt: "2026-01-01T00:00:00.000Z"
    })
    expect(dropped!.settings).toEqual({
      targetAt: "2026-12-31T00:00:00.000Z"
    })
  })

  it("sanitizes malformed settings fields back to their defaults", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, {
      widgets: sampleState.widgets,
      settings: { name: 7 }
    })

    const { readDayboardState } = await import("./storage")
    const state = await readDayboardState()

    expect(state.settings).toEqual({ name: "" })
  })
})

describe("normalizing widgets read from storage or an import", () => {
  const widget = (kind: string, settings: unknown, extra = {}) => ({
    id: kind,
    kind,
    title: "Card",
    colorPreset: "sky",
    settings,
    ...extra
  })

  const parse = async (widgets: unknown[]) => {
    const { parseDayboardState } = await import("./storage")

    return parseDayboardState(JSON.stringify({ widgets })).widgets
  }

  it("rebuilds each field a card reads when it arrives with the wrong type", async () => {
    const widgets = await parse([
      widget("clock", { timeZone: 5 }),
      widget("countdown", { targetAt: 123, startAt: 4, repeat: "fortnightly" }),
      widget("note", { text: null }),
      widget("quote", { quotes: ["One", 2, "Three"], rotation: "shuffled" }),
      widget("stopwatch", { running: true, elapsedMs: "y", startedAt: "x" }),
      widget("timer", { durationMs: -1, running: true, remainingMs: Number.NaN, endsAt: null })
    ])

    expect(widgets.map((entry) => entry.settings)).toEqual([
      { timeZone: "" },
      { targetAt: "" },
      { text: "" },
      { quotes: ["One", "Three"], rotation: "daily" },
      { running: false, elapsedMs: 0, startedAt: null },
      { durationMs: 300_000, running: false, remainingMs: 300_000, endsAt: null, chime: false }
    ])
  })

  it("falls back on the card's own fields too", async () => {
    const [entry] = await parse([
      widget("note", { text: "Hi" }, { title: { x: 1 }, colorPreset: "plaid", archived: "yes" })
    ])

    expect(entry).toEqual({
      id: "note",
      kind: "note",
      title: "",
      colorPreset: "slate",
      settings: { text: "Hi" }
    })
  })

  it("keeps fields this build does not know, for the version that wrote them", async () => {
    const [entry] = await parse([
      widget("countdown", { targetAt: "2027-01-01T00:00:00.000Z", repeat: "weekly", label: "later" }, { pinned: true })
    ])

    expect(entry).toMatchObject({
      pinned: true,
      settings: { targetAt: "2027-01-01T00:00:00.000Z", repeat: "weekly", label: "later" }
    })
  })

  it("drops a widget whose id repeats, and a kind that only exists on Object's prototype", async () => {
    const widgets = await parse([
      widget("note", { text: "first" }),
      widget("note", { text: "second" }),
      { ...widget("toString", {}), id: "odd" }
    ])

    expect(widgets.map((entry) => entry.settings)).toEqual([{ text: "first" }])
  })
})

describe("shareUnchanged", () => {
  it("keeps the previous board when a read or echo carries the same data", async () => {
    const { shareUnchanged } = await import("./storage")
    const echo = JSON.parse(JSON.stringify(sampleState)) as DayboardState

    expect(shareUnchanged(sampleState, echo)).toBe(sampleState)
  })

  it("keeps the widgets that did not change and swaps in the ones that did", async () => {
    const { shareUnchanged } = await import("./storage")
    const note = {
      id: "note-1",
      kind: "note",
      title: "Note",
      colorPreset: "mint",
      settings: { text: "a" }
    } as const
    const previous: DayboardState = { ...sampleState, widgets: [...sampleState.widgets, note] }
    // Key order differs from the page's own objects once a widget has been round-tripped, so it must not count as a change.
    const reordered = { settings: { text: "b" }, colorPreset: "mint", title: "Note", kind: "note", id: "note-1" } as const
    const next = shareUnchanged(previous, {
      ...previous,
      widgets: [JSON.parse(JSON.stringify(previous.widgets[0])), reordered]
    })

    expect(next).not.toBe(previous)
    expect(next.widgets[0]).toBe(previous.widgets[0])
    expect(next.widgets[1]).toBe(reordered)
    expect(next.settings).toBe(previous.settings)
  })

  it("adopts the incoming board outright when there is nothing to compare with", async () => {
    const { shareUnchanged } = await import("./storage")

    expect(shareUnchanged(null, sampleState)).toBe(sampleState)
  })
})

describe("serializeDayboardState / parseDayboardState", () => {
  it("round-trips a board through JSON", async () => {
    const { serializeDayboardState, parseDayboardState } = await import(
      "./storage"
    )

    expect(parseDayboardState(serializeDayboardState(sampleState))).toEqual(
      sampleState
    )
  })

  it("fills defaults for a board missing settings", async () => {
    const { parseDayboardState } = await import("./storage")

    const parsed = parseDayboardState(
      JSON.stringify({ widgets: sampleState.widgets })
    )

    expect(parsed.widgets).toEqual(sampleState.widgets)
    expect(parsed.settings).toEqual(sampleState.settings)
  })

  // The same normalization runs on an imported file, so a row the board would drop must not throw on the way through instead.
  it("drops a settings-less widget from an imported file rather than throwing", async () => {
    const { parseDayboardState } = await import("./storage")

    const parsed = parseDayboardState(
      JSON.stringify({
        widgets: [
          { id: "no-settings-habit", kind: "habit" },
          ...sampleState.widgets
        ]
      })
    )

    expect(parsed.widgets).toEqual(sampleState.widgets)
  })

  it("rejects invalid JSON and non-board payloads", async () => {
    const { parseDayboardState } = await import("./storage")

    expect(() => parseDayboardState("{ not json")).toThrow()
    expect(() => parseDayboardState(JSON.stringify({ nope: true }))).toThrow()
  })
})

describe("writeDayboardState", () => {
  it("stores the state object under the storage key", async () => {
    const { store } = stubChromeStorage()

    const { writeDayboardState } = await import("./storage")
    await writeDayboardState(sampleState)

    expect(store.get(STORAGE_KEY)).toEqual(sampleState)
  })

  // chrome.storage.sync rejects any single item over QUOTA_BYTES_PER_ITEM (8192 bytes of key + serialized value), and the whole board lives under one key, so even a board packed with habits at their fullest must stay under it or every save starts failing.
  it("keeps a board of full habit histories under the sync per-item quota", async () => {
    const QUOTA_BYTES_PER_ITEM = 8192
    const fullHistory = Array.from({ length: STORED_DAYS }, (_, offset) => {
      const d = new Date(2026, 6, 9)
      d.setDate(d.getDate() - offset)
      return toDayKey(d)
    })
    const habits: HabitWidget[] = Array.from({ length: 10 }, (_, index) => ({
      id: crypto.randomUUID(),
      kind: "habit",
      title: `A habit with a fairly long title ${index}`,
      colorPreset: "amber",
      settings: { history: fullHistory }
    }))
    const state: DayboardState = {
      widgets: habits,
      settings: { name: "Dan" }
    }

    const { store } = stubChromeStorage()
    const { writeDayboardState } = await import("./storage")
    await writeDayboardState(state)

    const stored = JSON.stringify(store.get(STORAGE_KEY))
    expect(STORAGE_KEY.length + stored.length).toBeLessThan(
      QUOTA_BYTES_PER_ITEM
    )
  })
})

describe("readCachedDayboardState", () => {
  it("returns null before anything has been cached", async () => {
    stubChromeStorage()

    const { readCachedDayboardState } = await import("./storage")

    expect(readCachedDayboardState()).toBeNull()
  })

  it("mirrors reads and writes so the next load is synchronous", async () => {
    const { store } = stubChromeStorage()
    store.set(STORAGE_KEY, sampleState)

    const { readCachedDayboardState, readDayboardState, writeDayboardState } =
      await import("./storage")

    await readDayboardState()
    expect(readCachedDayboardState()).toEqual(sampleState)

    const renamed = {
      ...sampleState,
      settings: { ...sampleState.settings, name: "Dan" }
    }
    await writeDayboardState(renamed)
    expect(readCachedDayboardState()).toEqual(renamed)
  })

  it("returns null when the cached value is corrupt", async () => {
    stubChromeStorage()

    const { CACHE_KEY, readCachedDayboardState } = await import("./storage")
    localStorage.setItem(CACHE_KEY, "{ not json")

    expect(readCachedDayboardState()).toBeNull()
  })
})

describe("watchDayboardState", () => {
  it("notifies on sync changes and unsubscribes on stop", async () => {
    const { addListener, removeListener } = stubChromeStorage()

    const { watchDayboardState } = await import("./storage")
    const handleChange = vi.fn()
    const stopWatching = watchDayboardState(handleChange)

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

  it("ignores a sync write to some other key", async () => {
    const { addListener } = stubChromeStorage()

    const { watchDayboardState } = await import("./storage")
    const handleChange = vi.fn()
    watchDayboardState(handleChange)

    const listener = addListener.mock.calls[0]?.[0]
    listener?.({ "some-other-key": { newValue: {} } }, "sync")

    expect(handleChange).not.toHaveBeenCalled()
  })

  it("falls back to a default board when another device clears the key", async () => {
    const { addListener } = stubChromeStorage()

    const { readCachedDayboardState, watchDayboardState } = await import(
      "./storage"
    )
    const cachedWhenNotified: (DayboardState | null)[] = []
    const handleChange = vi.fn<(next: DayboardState) => void>(() => {
      cachedWhenNotified.push(readCachedDayboardState())
    })
    watchDayboardState(handleChange)

    // Clearing sync storage elsewhere arrives as a change with an oldValue and no newValue.
    const listener = addListener.mock.calls[0]?.[0]
    listener?.({ [STORAGE_KEY]: { oldValue: sampleState } }, "sync")

    const [next] = handleChange.mock.calls[0] as [DayboardState]
    expect(next.widgets.map((widget) => widget.kind)).toEqual([
      "clock",
      "countdown",
      "note",
      "quote",
      "habit",
      "countdown"
    ])
    // The mirror is written before the listener runs, so a tab reloading in the middle of the sync hydrates to the same board rather than the one that was just cleared.
    expect(cachedWhenNotified[0]).toEqual(next)
  })
})
