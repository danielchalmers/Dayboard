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
    const length = 3
    const indices = Array.from({ length: length + 1 }, (_, offset) =>
      dailyQuoteIndex(new Date(2026, 0, 1 + offset, 12, 0, 0), length)
    )

    // Every quote gets its day before any comes back, and the day after the last one starts the list over.
    expect(new Set(indices.slice(0, length)).size).toBe(length)
    indices.slice(1).forEach((index, day) => {
      expect(index).toBe((indices[day]! + 1) % length)
    })
    expect(indices[length]).toBe(indices[0])
  })

  it("turns over at local midnight, including the short day of a DST change", () => {
    // America/Chicago springs forward on 2026-03-08, so that day is 23 hours long.
    const lateSaturday = new Date(2026, 2, 7, 23, 59, 0)
    const earlySunday = new Date(2026, 2, 8, 0, 1, 0)
    const lateSunday = new Date(2026, 2, 8, 23, 59, 0)
    const earlyMonday = new Date(2026, 2, 9, 0, 1, 0)

    expect(dailyQuoteIndex(earlySunday, 5)).toBe((dailyQuoteIndex(lateSaturday, 5) + 1) % 5)
    expect(dailyQuoteIndex(lateSunday, 5)).toBe(dailyQuoteIndex(earlySunday, 5))
    expect(dailyQuoteIndex(earlyMonday, 5)).toBe((dailyQuoteIndex(lateSunday, 5) + 1) % 5)
  })

  it("returns 0 for an empty list", () => {
    expect(dailyQuoteIndex(new Date(), 0)).toBe(0)
  })
})
