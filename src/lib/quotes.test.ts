import { describe, expect, it } from "vitest"

import { cleanQuotes, dailyQuoteIndex, quotesToText, textToQuotes } from "./quotes"

describe("textToQuotes / quotesToText", () => {
  it("round-trips multi-line text without dropping blank lines", () => {
    const text = "first\n\nsecond"
    expect(quotesToText(textToQuotes(text))).toBe(text)
  })
})

describe("cleanQuotes", () => {
  it("trims entries and removes blank lines", () => {
    expect(cleanQuotes(["  hello ", "", "   ", "world"])).toEqual([
      "hello",
      "world"
    ])
  })
})

describe("dailyQuoteIndex", () => {
  it("is stable for the same calendar day", () => {
    const morning = new Date(2026, 0, 1, 8, 0, 0)
    const evening = new Date(2026, 0, 1, 23, 0, 0)

    expect(dailyQuoteIndex(morning, 5)).toBe(dailyQuoteIndex(evening, 5))
  })

  it("advances by one each day and wraps around the list", () => {
    const day1 = new Date(2026, 0, 1, 12, 0, 0)
    const day2 = new Date(2026, 0, 2, 12, 0, 0)
    const length = 3

    const i1 = dailyQuoteIndex(day1, length)
    const i2 = dailyQuoteIndex(day2, length)

    expect(i2).toBe((i1 + 1) % length)
    expect(i1).toBeGreaterThanOrEqual(0)
    expect(i1).toBeLessThan(length)
  })

  it("returns 0 for an empty list", () => {
    expect(dailyQuoteIndex(new Date(), 0)).toBe(0)
  })
})
