import { describe, expect, it } from "vitest"

import {
  dateTimeInputValueToIsoInstant,
  formatRelativeCountdown,
  getCountdownParts,
  getCountdownProgress,
  isoInstantToDateTimeInputValue,
  nextCountdownTarget
} from "./time"
import type { CountdownWidget } from "./types"

const countdownWidget = (targetAt: string): CountdownWidget => ({
  id: "launch",
  kind: "countdown",
  title: "Launch",
  colorPreset: "slate",
  settings: {
    targetAt
  }
})

describe("nextCountdownTarget", () => {
  const now = new Date(2026, 5, 19, 12, 0, 0)
  const DAY = 24 * 60 * 60 * 1000

  it("leaves a non-repeating or still-future target unchanged", () => {
    const past = new Date(2020, 0, 1, 9, 0, 0).toISOString()
    const future = new Date(2026, 11, 25, 9, 0, 0).toISOString()

    expect(nextCountdownTarget(past, "none", now)).toBe(past)
    expect(nextCountdownTarget(past, undefined, now)).toBe(past)
    expect(nextCountdownTarget(future, "weekly", now)).toBe(future)
  })

  it("rolls a daily target to the next future day, keeping the time", () => {
    const target = new Date(2026, 5, 17, 9, 0, 0).toISOString()
    const next = new Date(nextCountdownTarget(target, "daily", now))

    expect(next.getTime()).toBeGreaterThan(now.getTime())
    expect(next.getHours()).toBe(9)
    expect(next.getTime() - now.getTime()).toBeLessThanOrEqual(DAY)
  })

  it("rolls a weekly target to within a week", () => {
    const target = new Date(2026, 4, 4, 8, 0, 0).toISOString()
    const next = new Date(nextCountdownTarget(target, "weekly", now))

    expect(next.getTime()).toBeGreaterThan(now.getTime())
    expect(next.getDay()).toBe(new Date(target).getDay())
    expect(next.getTime() - now.getTime()).toBeLessThanOrEqual(7 * DAY)
  })

  it("rolls a yearly target to the same month and day next year", () => {
    const target = new Date(2025, 11, 25, 9, 0, 0).toISOString()
    const next = new Date(nextCountdownTarget(target, "yearly", now))

    expect(next.getTime()).toBeGreaterThan(now.getTime())
    expect(next.getMonth()).toBe(11)
    expect(next.getDate()).toBe(25)
    expect(next.getFullYear()).toBe(2026)
  })
})

describe("getCountdownProgress", () => {
  const progressWidget: CountdownWidget = {
    id: "year",
    kind: "countdown",
    title: "Year",
    colorPreset: "slate",
    settings: {
      display: "progress",
      startAt: "2026-01-01T00:00:00.000Z",
      targetAt: "2026-01-11T00:00:00.000Z"
    }
  }

  it("is the fraction of the span elapsed", () => {
    expect(
      getCountdownProgress(progressWidget, new Date("2026-01-06T00:00:00.000Z"))
    ).toBeCloseTo(0.5)
  })

  it("clamps before the start and after the target", () => {
    expect(
      getCountdownProgress(progressWidget, new Date("2025-12-01T00:00:00.000Z"))
    ).toBe(0)
    expect(
      getCountdownProgress(progressWidget, new Date("2027-01-01T00:00:00.000Z"))
    ).toBe(1)
  })

  it("falls back when no start is set", () => {
    const noStart = countdownWidget("2026-01-11T00:00:00.000Z")
    expect(
      getCountdownProgress(noStart, new Date("2026-01-01T00:00:00.000Z"))
    ).toBe(0)
    expect(
      getCountdownProgress(noStart, new Date("2026-02-01T00:00:00.000Z"))
    ).toBe(1)
  })
})

describe("datetime-local countdown conversions", () => {
  it("converts a local input value into an ISO instant", () => {
    expect(dateTimeInputValueToIsoInstant("2026-01-02T03:04")).toBe(
      new Date(2026, 0, 2, 3, 4, 0, 0).toISOString()
    )
  })

  it("converts an ISO instant into a datetime-local value", () => {
    expect(
      isoInstantToDateTimeInputValue(new Date(2026, 0, 2, 3, 4, 0, 0).toISOString())
    ).toBe("2026-01-02T03:04")
  })
})

describe("getCountdownParts", () => {
  it("returns remaining time parts for a future target", () => {
    const parts = getCountdownParts(
      countdownWidget("2026-01-02T03:04:00.000Z"),
      new Date("2026-01-01T00:00:00.000Z")
    )

    expect(parts.status).toBe("future")
    expect(parts.days).toBe(1)
    expect(parts.hours).toBe(3)
    expect(parts.minutes).toBe(4)
    expect(parts.seconds).toBe(0)
    expect(parts.label).toBe("1 day, 3 hours from now")
  })

  it("marks just-passed targets as due", () => {
    const parts = getCountdownParts(
      countdownWidget("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-01T00:00:30.000Z")
    )

    expect(parts.status).toBe("due")
    expect(parts.label).toBe("just now")
  })
})

describe("formatRelativeCountdown", () => {
  it("uses the two most useful units", () => {
    expect(formatRelativeCountdown(2 * 86_400_000 + 5 * 3_600_000 + 9 * 60_000)).toBe(
      "2 days, 5 hours from now"
    )
  })

  it("describes past targets without configuration", () => {
    expect(formatRelativeCountdown(-(3 * 3_600_000 + 12 * 60_000))).toBe(
      "3 hours, 12 minutes ago"
    )
  })
})
