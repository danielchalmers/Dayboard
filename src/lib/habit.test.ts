import { describe, expect, it } from "vitest"

import { currentStreak, recentDays, toDayKey, toggleToday } from "./habit"

const now = new Date(2026, 5, 19, 9, 0, 0)
const key = (offset: number) => {
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  return toDayKey(d)
}

describe("toggleToday", () => {
  it("adds today when missing and removes it when present", () => {
    const added = toggleToday([], now)
    expect(added).toEqual([key(0)])
    expect(toggleToday(added, now)).toEqual([])
  })

  it("prunes history older than the retention window", () => {
    const result = toggleToday([key(-500), key(-10)], now)

    expect(result).toContain(key(-10))
    expect(result).toContain(key(0))
    expect(result).not.toContain(key(-500))
  })
})

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(currentStreak([key(-2), key(-1), key(0)], now)).toBe(3)
  })

  it("keeps yesterday's streak alive before today is done", () => {
    expect(currentStreak([key(-2), key(-1)], now)).toBe(2)
  })

  it("breaks when the most recent day is older than yesterday", () => {
    expect(currentStreak([key(-3), key(-2)], now)).toBe(0)
  })

  it("ignores gaps further back", () => {
    expect(currentStreak([key(-5), key(-1), key(0)], now)).toBe(2)
  })

  it("is zero with no history", () => {
    expect(currentStreak([], now)).toBe(0)
  })
})

describe("recentDays", () => {
  it("returns the last N days, oldest first, ending today", () => {
    const days = recentDays(now, 7).map(toDayKey)
    expect(days).toHaveLength(7)
    expect(days[6]).toBe(key(0))
    expect(days[0]).toBe(key(-6))
  })
})
