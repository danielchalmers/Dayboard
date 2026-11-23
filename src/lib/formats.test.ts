// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import type { DayboardState } from "./types"

// What Dayboard has stored and exported is a promise to whoever holds it: a browser that updates must find its board, and a file exported years ago must still import.
// The files in ./fixtures are that promise written down. Real builds wrote them, driven in Chromium over one profile in America/Chicago, the zone this suite runs in.
// The v0.9.1 release went first, from its first run: a name, a habit day, a line typed in the note, and eight cards of the kinds and shapes builds up to it stored, with no zone on any countdown.
// Then the build that added these files opened the same profile, and changing the name there was the board's first save.
//
// The files are never edited or regenerated. The tests that read them never change: if one fails, the change that broke it is wrong.
// The two that write say the format written today is the latest one recorded, so a change that writes anything differently fails them on purpose.
// The way through is a new file written by that build, read and written by tests of its own, with these kept and still read.
const LEGACY_KEY = "dayboard-state"
const BOARD_KEY = "dayboard-board"
const CARD_PREFIX = "dayboard-card:"

type Items = Record<string, unknown>

const text = (name: string): string =>
  readFileSync(join(import.meta.dirname, "fixtures", name), "utf8")
const items = (name: string): Items => JSON.parse(text(name)) as Items

const stubSync = (stored: Items) => {
  const store = new Map(Object.entries(structuredClone(stored)))

  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        get: vi.fn(async () => Object.fromEntries(store)),
        set: vi.fn(async (changed: Items) => {
          Object.entries(changed).forEach(([key, value]) => store.set(key, structuredClone(value)))
        }),
        remove: vi.fn(async (keys: string[]) => {
          keys.forEach((key) => store.delete(key))
        })
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() }
    }
  })

  return store
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  localStorage.clear()
})

// The three countdowns whose ends are dates: the year card, Christmas, and the sprint.
const DATES = [
  "year-progress",
  "0b9a4c1e-88f2-4d0a-a7c3-51e6d2f4a902",
  "e81d3f09-6b7c-4a25-b1d4-0a9c8e7f6d23"
]

// The board v0.9.1 stored, as it reads here: every card as it was, and the dates given the zone they were set in.
// The Morning card, which repeats daily, and the launch at 9:30 AM are moments, and stay without one.
const left = (): DayboardState => {
  const stored = items("v0.9.1-sync.json")[LEGACY_KEY] as DayboardState

  return {
    ...stored,
    widgets: stored.widgets.map((widget) =>
      DATES.includes(widget.id)
        ? ({
            ...widget,
            settings: { ...widget.settings, timeZone: "America/Chicago" }
          } as typeof widget)
        : widget
    )
  }
}

// The same board after the one change made on this build.
const kept = (): DayboardState => ({ ...left(), settings: { name: "Samira" } })

describe("the board v0.9.1 left", () => {
  it("is a board of every kind, so the tests below are about something", () => {
    const board = left()

    expect(board.settings).toEqual({ name: "Sam" })
    expect(board.widgets).toHaveLength(14)
    expect(new Set(board.widgets.map((widget) => widget.kind))).toEqual(
      new Set(["clock", "countdown", "note", "quote", "stopwatch", "timer", "habit", "todo"])
    )
    expect(board.widgets.filter((widget) => widget.archived)).toHaveLength(1)
  })

  it("is read whole from the single item it was kept in", async () => {
    stubSync(items("v0.9.1-sync.json"))

    const { readDayboardState } = await import("./storage")

    expect(await readDayboardState()).toEqual(left())
  })

  it("is read the same from the file v0.9.1 exported", async () => {
    const { parseDayboardState } = await import("./storage")

    expect(parseDayboardState(text("v0.9.1-export.json"))).toEqual(left())
  })

  it("is not written to by being read", async () => {
    const store = stubSync(items("v0.9.1-sync.json"))

    const { readDayboardState } = await import("./storage")
    await readDayboardState()

    expect(Object.fromEntries(store)).toEqual(items("v0.9.1-sync.json"))
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
  })
})

describe("the board as it is kept now", () => {
  it("is read whole from one item to a card", async () => {
    stubSync(items("v1-sync.json"))

    const { readDayboardState } = await import("./storage")

    expect(await readDayboardState()).toEqual(kept())
  })

  it("is read the same from the file exported from them", async () => {
    const { parseDayboardState } = await import("./storage")

    expect(parseDayboardState(text("v1-export.json"))).toEqual(kept())
  })

  it("is what the v0.9.1 board becomes on its first save", async () => {
    const store = stubSync(items("v0.9.1-sync.json"))

    const { readDayboardState, writeDayboardState } = await import("./storage")
    const state = await readDayboardState()
    await writeDayboardState({ ...state, settings: { ...state.settings, name: "Samira" } }, state)

    const { [LEGACY_KEY]: note, ...written } = Object.fromEntries(store)
    const { [LEGACY_KEY]: recordedNote, ...recorded } = items("v1-sync.json")

    expect(written).toEqual(recorded)
    // The old item holds the note for builds that only read it. Its wording is not part of the format; that it is this one note is.
    expect(note).toMatchObject({ widgets: [{ id: "dayboard-moved", kind: "note" }] })
    expect(recordedNote).toMatchObject({ widgets: [{ id: "dayboard-moved", kind: "note" }] })
  })

  it("is exported as the file recorded", async () => {
    stubSync(items("v1-sync.json"))

    const { readDayboardState, serializeDayboardState } = await import("./storage")
    const exported: unknown = JSON.parse(serializeDayboardState(await readDayboardState()))

    expect(exported).toEqual(JSON.parse(text("v1-export.json")))
  })
})

// The other half of the promise: a later build adds to the format with new kinds, new fields and new items, and this one, still open on another device, saves around them.
// No later build exists to write this, so it is the recorded board with additions made by hand.
describe("what a later build adds to the board", () => {
  const TEA = `${CARD_PREFIX}9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d`
  const LINKS = `${CARD_PREFIX}links-1`

  const later = (): Items => {
    const stored = items("v1-sync.json")
    const board = stored[BOARD_KEY] as { order: string[]; settings: object }
    const tea = stored[TEA] as { settings: object }

    return {
      ...stored,
      // A kind this build has no card for, in the middle of the board.
      [LINKS]: { kind: "links", title: "Links", colorPreset: "sky", settings: { links: ["a"] } },
      [TEA]: { ...tea, pinned: true, settings: { ...tea.settings, sound: "bell" } },
      [BOARD_KEY]: {
        ...board,
        order: [...board.order.slice(0, 3), "links-1", ...board.order.slice(3)],
        settings: { ...board.settings, weekStart: "sunday" },
        layout: { columns: 2 }
      },
      "dayboard-device": { seen: 3 }
    }
  }

  it("is still there after this build has saved around it", async () => {
    const store = stubSync(later())

    const { readDayboardState, writeDayboardState } = await import("./storage")
    const state = await readDayboardState()

    // A rename, an edit to the card that carries the new fields, and a new order: each of the three things a save writes.
    const renamed = { ...state, settings: { ...state.settings, name: "Sam" } }
    await writeDayboardState(renamed, state)
    const edited = {
      ...renamed,
      widgets: renamed.widgets.map((widget) =>
        widget.title === "Tea" ? { ...widget, title: "Green tea" } : widget
      )
    }
    await writeDayboardState(edited, renamed)
    const reordered = { ...edited, widgets: [...edited.widgets].reverse() }
    await writeDayboardState(reordered, edited)

    const before = later()

    expect(store.get(LINKS)).toEqual(before[LINKS])
    expect(store.get(TEA)).toEqual({ ...(before[TEA] as object), title: "Green tea" })
    expect(store.get("dayboard-device")).toEqual({ seen: 3 })
    expect(store.get(BOARD_KEY)).toMatchObject({
      settings: { name: "Sam", weekStart: "sunday" },
      layout: { columns: 2 }
    })
    expect((store.get(BOARD_KEY) as { order: string[] }).order).toContain("links-1")
    // Nothing went missing either: the same items, and the same cards in the order.
    expect([...store.keys()].sort()).toEqual(Object.keys(before).sort())
    expect([...(store.get(BOARD_KEY) as { order: string[] }).order].sort()).toEqual(
      [...(before[BOARD_KEY] as { order: string[] }).order].sort()
    )
  })
})
