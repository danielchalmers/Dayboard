import { describe, expect, it } from "vitest"

import { getGreeting, getTimeOfDayGreeting } from "./greeting"

const at = (hour: number) => new Date(2026, 0, 1, hour, 0, 0)

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
