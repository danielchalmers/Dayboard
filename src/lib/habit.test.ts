import { describe, expect, it } from "vitest"

import {
  formatWeekRange,
  isDoneOn,
  normalizeHistory,
  startOfWeek,
  STORED_DAYS,
  toDayKey,
  toggleDay,
  weekdayInitials,
  weekDays
} from "./habit"

// A Friday, so the week has days on both sides of today.
const now = new Date(2026, 5, 19, 9, 0, 0)
const key = (offset: number) => {
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  return toDayKey(d)
}
const day = (offset: number) => {
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  return d
}

describe("toggleDay", () => {
  it("adds a day when missing and removes it when present", () => {
    const added = toggleDay([], now)
    expect(added).toEqual([key(0)])
    expect(toggleDay(added, now)).toEqual([])
  })

  it("marks an earlier day without touching today", () => {
    const result = toggleDay([key(0)], day(-3))

    expect(result).toEqual([key(-3), key(0)])
  })

  it("keeps only the newest week of entries", () => {
    const crowded = Array.from({ length: 20 }, (_, offset) => key(-offset - 1))

    const result = toggleDay(crowded, now)

    expect(result).toHaveLength(STORED_DAYS)
    expect(result).toContain(key(0))
    expect(result).not.toContain(key(-20))
  })
})

describe("isDoneOn", () => {
  it("is true only for days in the history", () => {
    const history = [key(-2), key(0)]

    expect(isDoneOn(history, day(0))).toBe(true)
    expect(isDoneOn(history, day(-2))).toBe(true)
    expect(isDoneOn(history, day(-1))).toBe(false)
    expect(isDoneOn([], day(0))).toBe(false)
  })
})

describe("normalizeHistory", () => {
  it("prunes a legacy unbounded history to the visible week", () => {
    const years = Array.from({ length: 400 }, (_, offset) => key(-offset))

    const result = normalizeHistory(years)

    expect(result).toEqual(Array.from({ length: STORED_DAYS }, (_, i) => key(i - STORED_DAYS + 1)))
  })

  it("drops entries that are not day keys and deduplicates", () => {
    expect(normalizeHistory([42, "junk", key(0), key(0), "2026-1-2"])).toEqual([key(0)])
  })

  it("normalizes junk to an empty history", () => {
    expect(normalizeHistory(undefined)).toEqual([])
    expect(normalizeHistory("garbage")).toEqual([])
    expect(normalizeHistory({ streakStart: key(0) })).toEqual([])
  })
})

describe("startOfWeek", () => {
  it("rolls back to Monday at midnight", () => {
    expect(toDayKey(startOfWeek(now))).toBe("2026-06-15")
    expect(startOfWeek(now).getHours()).toBe(0)
  })

  it("keeps a day that is already a Monday", () => {
    const monday = new Date(2026, 5, 15, 22, 0, 0)

    expect(toDayKey(startOfWeek(monday))).toBe("2026-06-15")
  })

  it("treats Sunday as the end of the week it closes, not the start", () => {
    const sunday = new Date(2026, 5, 21, 9, 0, 0)

    expect(toDayKey(startOfWeek(sunday))).toBe("2026-06-15")
  })
})

describe("weekDays", () => {
  it("runs Monday to Sunday around today", () => {
    expect(weekDays(now).map(toDayKey)).toEqual([
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21"
    ])
  })

  it("never draws a day the history has already pruned", () => {
    expect(normalizeHistory(weekDays(now).map(toDayKey))).toHaveLength(STORED_DAYS)
  })
})

describe("formatWeekRange", () => {
  it("reads as a date range and folds a shared month", () => {
    expect(formatWeekRange(weekDays(now))).toMatch(/Jun 15\s*–\s*21/)
    expect(formatWeekRange(weekDays(new Date(2026, 6, 1)))).toMatch(/Jun 29\s*–\s*Jul 5/)
    expect(formatWeekRange([])).toBe("")
  })
})

describe("weekdayInitials", () => {
  it("starts on Monday", () => {
    expect(weekdayInitials()).toEqual(["M", "T", "W", "T", "F", "S", "S"])
  })
})
