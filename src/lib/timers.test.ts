import { describe, expect, it } from "vitest"

import type { StopwatchWidget, TimerWidget } from "./types"
import {
  finishTimer,
  formatDuration,
  msToParts,
  partsToMs,
  pauseStopwatch,
  pauseTimer,
  resetStopwatch,
  resetTimer,
  startStopwatch,
  startTimer,
  stopwatchElapsedMs,
  timerRemainingMs
} from "./timers"

const stopwatch = (
  settings: Partial<StopwatchWidget["settings"]> = {}
): StopwatchWidget["settings"] => ({
  running: false,
  elapsedMs: 0,
  startedAt: null,
  ...settings
})

const timer = (
  settings: Partial<TimerWidget["settings"]> = {}
): TimerWidget["settings"] => ({
  durationMs: 300_000,
  running: false,
  remainingMs: 300_000,
  endsAt: null,
  ...settings
})

describe("formatDuration", () => {
  it("formats under an hour as M:SS", () => {
    expect(formatDuration(0)).toBe("0:00")
    expect(formatDuration(90_000)).toBe("1:30")
    expect(formatDuration(599_000)).toBe("9:59")
  })

  it("formats an hour or more as H:MM:SS", () => {
    expect(formatDuration(3_661_000)).toBe("1:01:01")
  })

  it("never goes negative", () => {
    expect(formatDuration(-5_000)).toBe("0:00")
  })
})

describe("msToParts / partsToMs", () => {
  it("round-trips a duration", () => {
    const parts = { hours: 1, minutes: 23, seconds: 45 }
    expect(msToParts(partsToMs(parts))).toEqual(parts)
  })
})

describe("stopwatch", () => {
  it("reports banked time while paused and live time while running", () => {
    expect(stopwatchElapsedMs(stopwatch({ elapsedMs: 5_000 }), 10_000)).toBe(5_000)
    expect(
      stopwatchElapsedMs(
        stopwatch({ running: true, elapsedMs: 5_000, startedAt: 10_000 }),
        13_000
      )
    ).toBe(8_000)
  })

  it("starts, pauses banking elapsed time, and resets", () => {
    const started = startStopwatch(stopwatch({ elapsedMs: 2_000 }), 100_000)
    expect(started).toEqual({ running: true, elapsedMs: 2_000, startedAt: 100_000 })

    const paused = pauseStopwatch(started, 103_500)
    expect(paused).toEqual({ running: false, elapsedMs: 5_500, startedAt: null })

    expect(resetStopwatch()).toEqual({
      running: false,
      elapsedMs: 0,
      startedAt: null
    })
  })
})

describe("timer", () => {
  it("reports remaining time while paused and running", () => {
    expect(timerRemainingMs(timer({ remainingMs: 60_000 }), 0)).toBe(60_000)
    expect(
      timerRemainingMs(timer({ running: true, endsAt: 70_000 }), 65_000)
    ).toBe(5_000)
    expect(
      timerRemainingMs(timer({ running: true, endsAt: 70_000 }), 999_999)
    ).toBe(0)
  })

  it("starts from the remaining time and sets an end stamp", () => {
    const started = startTimer(timer({ remainingMs: 120_000 }), 1_000)
    expect(started.running).toBe(true)
    expect(started.endsAt).toBe(121_000)
    expect(started.remainingMs).toBe(120_000)
  })

  it("starts a full fresh duration when none is left", () => {
    const started = startTimer(timer({ remainingMs: 0 }), 1_000)
    expect(started.remainingMs).toBe(300_000)
    expect(started.endsAt).toBe(301_000)
  })

  it("pauses by banking the remaining time", () => {
    const paused = pauseTimer(timer({ running: true, endsAt: 50_000 }), 20_000)
    expect(paused).toMatchObject({ running: false, remainingMs: 30_000, endsAt: null })
  })

  it("resets to the full duration and finishes at zero", () => {
    expect(resetTimer(timer({ remainingMs: 1_000 }))).toMatchObject({
      running: false,
      remainingMs: 300_000,
      endsAt: null
    })
    expect(finishTimer(timer({ running: true, endsAt: 1 }))).toMatchObject({
      running: false,
      remainingMs: 0,
      endsAt: null
    })
  })
})
