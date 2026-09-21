// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  finestGranularity,
  floorToGranularity,
  msUntilNext,
  readClock,
  subscribeToClock,
  widgetClockGranularity
} from "./clock"
import type { Widget } from "./types"

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: hidden ? "hidden" : "visible"
  })
  document.dispatchEvent(new Event("visibilitychange"))
}

describe("floorToGranularity", () => {
  it("floors to the second and the minute on the epoch grid", () => {
    const at = new Date(2026, 2, 4, 10, 17, 42, 900).getTime()

    expect(floorToGranularity(at, "second")).toBe(
      new Date(2026, 2, 4, 10, 17, 42).getTime()
    )
    expect(floorToGranularity(at, "minute")).toBe(
      new Date(2026, 2, 4, 10, 17).getTime()
    )
  })

  it("floors a day to local midnight, not UTC midnight", () => {
    const at = new Date(2026, 2, 4, 1, 30).getTime()

    expect(floorToGranularity(at, "day")).toBe(new Date(2026, 2, 4).getTime())
  })
})

describe("msUntilNext", () => {
  it("aims at the next boundary rather than a fixed interval", () => {
    const at = new Date(2026, 2, 4, 10, 17, 42, 900).getTime()

    expect(msUntilNext(at, "second")).toBe(100)
    expect(msUntilNext(at, "minute")).toBe(17_100)
  })

  it("aims a day at the following local midnight across a DST change", () => {
    // The suite runs in America/Chicago, where 2026-03-08 has 23 hours: a plain 24h wait would land an hour past midnight.
    const at = new Date(2026, 2, 8, 0, 0).getTime()

    expect(msUntilNext(at, "day")).toBe(23 * 3_600_000)
  })

  it("waits a full unit when already on a boundary", () => {
    expect(msUntilNext(new Date(2026, 2, 4, 10, 17).getTime(), "minute")).toBe(60_000)
  })
})

describe("finestGranularity", () => {
  it("picks the finest of what is wanted and nothing when nothing is", () => {
    expect(finestGranularity(["day", "minute", "day"])).toBe("minute")
    expect(finestGranularity(["day", "second"])).toBe("second")
    expect(finestGranularity([])).toBeNull()
  })
})

describe("widgetClockGranularity", () => {
  const widget = (kind: Widget["kind"], settings: object = {}): Widget =>
    ({ id: kind, kind, title: kind, colorPreset: "sky", settings }) as Widget

  it("gives clocks and countdowns the minute they print", () => {
    expect(widgetClockGranularity(widget("clock", { timeZone: "" }))).toBe("minute")
    expect(widgetClockGranularity(widget("countdown", { targetAt: "" }))).toBe("minute")
  })

  it("gives a stopwatch or timer seconds only while it runs", () => {
    expect(widgetClockGranularity(widget("stopwatch", { running: true }))).toBe("second")
    expect(widgetClockGranularity(widget("stopwatch", { running: false }))).toBe("day")
    expect(widgetClockGranularity(widget("timer", { running: true }))).toBe("second")
    expect(widgetClockGranularity(widget("timer", { running: false }))).toBe("day")
  })

  it("wakes everything else only at midnight", () => {
    for (const kind of ["habit", "quote", "note", "todo"] as const) {
      expect(widgetClockGranularity(widget(kind))).toBe("day")
    }
  })
})

describe("the shared clock", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 4, 10, 17, 42, 900))
    setHidden(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps one timeout aimed at the finest subscriber's next boundary", () => {
    const minute = vi.fn()
    const unsubscribeMinute = subscribeToClock(minute, "minute")

    expect(vi.getTimerCount()).toBe(1)
    minute.mockClear()

    // Nothing fires inside the minute.
    vi.advanceTimersByTime(17_000)
    expect(minute).not.toHaveBeenCalled()

    // The boundary itself does.
    vi.advanceTimersByTime(100)
    expect(minute).toHaveBeenCalledTimes(1)
    expect(readClock()).toBe(new Date(2026, 2, 4, 10, 18).getTime())

    // A second-level subscriber tightens the single timeout rather than adding one.
    const second = vi.fn()
    const unsubscribeSecond = subscribeToClock(second, "second")
    expect(vi.getTimerCount()).toBe(1)
    second.mockClear()
    minute.mockClear()

    vi.advanceTimersByTime(1_000)
    expect(second).toHaveBeenCalledTimes(1)
    // Every listener is told on a tick; consumers compare their own floored snapshot, so this costs the minute card nothing.
    expect(minute).toHaveBeenCalledTimes(1)

    // Dropping the second-level subscriber loosens it back to the minute.
    unsubscribeSecond()
    minute.mockClear()
    vi.advanceTimersByTime(30_000)
    expect(minute).not.toHaveBeenCalled()

    unsubscribeMinute()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("stops while the tab is hidden and catches up the moment it shows", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToClock(listener, "second")
    listener.mockClear()

    setHidden(true)
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(90_000)
    expect(listener).not.toHaveBeenCalled()

    setHidden(false)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(readClock()).toBe(new Date(2026, 2, 4, 10, 19, 12, 900).getTime())
    expect(vi.getTimerCount()).toBe(1)

    unsubscribe()
  })

  it("does not start a timeout for a tab that is already hidden", () => {
    setHidden(true)
    const unsubscribe = subscribeToClock(vi.fn(), "second")

    expect(vi.getTimerCount()).toBe(0)

    unsubscribe()
    setHidden(false)
  })
})
