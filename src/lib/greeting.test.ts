import { describe, expect, it } from "vitest"

import {
  getDaypart,
  getGreeting,
  getHeaderDate,
  getTimeOfDayGreeting
} from "./greeting"

const at = (hour: number) => new Date(2026, 0, 1, hour, 0, 0)

describe("getDaypart", () => {
  it("splits the day at 5, 12, 17, and 22", () => {
    expect(getDaypart(at(5))).toBe("morning")
    expect(getDaypart(at(11))).toBe("morning")
    expect(getDaypart(at(12))).toBe("afternoon")
    expect(getDaypart(at(16))).toBe("afternoon")
    expect(getDaypart(at(17))).toBe("evening")
    expect(getDaypart(at(21))).toBe("evening")
    expect(getDaypart(at(22))).toBe("night")
    expect(getDaypart(at(4))).toBe("night")
  })
})

describe("getHeaderDate", () => {
  it("spells out the weekday, month, and day", () => {
    const date = new Date(2026, 6, 7)
    const formatted = getHeaderDate(date)
    const part = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(undefined, options).format(date)

    // The order is the locale's, but the long names of all three parts must be there, and no year.
    expect(formatted).toContain(part({ weekday: "long" }))
    expect(formatted).toContain(part({ month: "long" }))
    expect(formatted).toMatch(/\b7\b/)
    expect(formatted).not.toContain("2026")
  })
})

describe("getTimeOfDayGreeting", () => {
  it("changes with the local hour", () => {
    expect(getTimeOfDayGreeting(at(8))).toBe("Good morning")
    expect(getTimeOfDayGreeting(at(14))).toBe("Good afternoon")
    expect(getTimeOfDayGreeting(at(19))).toBe("Good evening")
    expect(getTimeOfDayGreeting(at(23))).toBe("Good night")
    expect(getTimeOfDayGreeting(at(3))).toBe("Good night")
  })
})

describe("getGreeting", () => {
  it("appends a trimmed name when present", () => {
    expect(getGreeting(at(8), "Sam")).toBe("Good morning, Sam")
    expect(getGreeting(at(8), "  Sam  ")).toBe("Good morning, Sam")
  })

  it("omits the name when blank", () => {
    expect(getGreeting(at(8), "")).toBe("Good morning")
    expect(getGreeting(at(8), "   ")).toBe("Good morning")
  })
})
