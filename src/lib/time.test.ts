import { describe, expect, it } from "vitest"

import {
  dateTimeInputValueToIsoInstant,
  formatClockDate,
  formatClockTime,
  formatCountdownTarget,
  formatRelativeCountdown,
  formatTimeZoneName,
  getCountdownParts,
  getCountdownPercent,
  getCountdownProgress,
  isKnownTimeZone,
  isSameLocalDay,
  isoInstantToDateTimeInputValue,
  resolveCountdown
} from "./time"
import type { ClockWidget, CountdownRepeat, CountdownWidget } from "./types"

const countdownWidget = (
  targetAt: string,
  settings: Partial<CountdownWidget["settings"]> = {}
): CountdownWidget => ({
  id: "launch",
  kind: "countdown",
  title: "Launch",
  colorPreset: "slate",
  settings: {
    targetAt,
    ...settings
  }
})

const nextCountdownTarget = (
  targetAt: string,
  repeat: CountdownRepeat | undefined,
  now: Date
): string =>
  resolveCountdown(countdownWidget(targetAt, { repeat }), now).settings.targetAt

describe("isSameLocalDay", () => {
  it("is true for two instants on the same local day", () => {
    expect(
      isSameLocalDay(new Date(2026, 2, 2, 0, 0, 0), new Date(2026, 2, 2, 23, 59, 59))
    ).toBe(true)
  })

  it("is false a minute either side of local midnight", () => {
    expect(
      isSameLocalDay(new Date(2026, 2, 2, 23, 59, 0), new Date(2026, 2, 3, 0, 1, 0))
    ).toBe(false)
  })

  it("separates the same day number in different months and years", () => {
    expect(
      isSameLocalDay(new Date(2026, 2, 2, 12, 0, 0), new Date(2026, 3, 2, 12, 0, 0))
    ).toBe(false)
    expect(
      isSameLocalDay(new Date(2025, 2, 2, 12, 0, 0), new Date(2026, 2, 2, 12, 0, 0))
    ).toBe(false)
  })
})

describe("clock formatters", () => {
  const clockWidget = (timeZone: string): ClockWidget => ({
    id: "somewhere",
    kind: "clock",
    title: "Somewhere",
    colorPreset: "slate",
    settings: { timeZone }
  })

  const instant = new Date("2026-01-01T12:30:00.000Z")
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  // Free text typed into the clock dialog, saved as-is, and not a zone any browser knows.
  const UNKNOWN_ZONE = "Not/AZone"

  it("reads the wall clock of the zone it is given", () => {
    expect(formatClockTime(instant, clockWidget("UTC"))).toMatch(/12:30/)
    expect(formatClockDate(instant, "UTC")).toMatch(/Thu, Jan 1, 2026/)
    expect(formatTimeZoneName(instant, "UTC")).toBe("UTC")
  })

  // Intl throws a RangeError on a zone it does not recognize, and all three of these run from a card's render, so an unguarded throw takes the whole board down rather than the one clock.
  it("falls back to local time on a zone the browser does not know", () => {
    expect(() => new Intl.DateTimeFormat(undefined, { timeZone: UNKNOWN_ZONE }))
      .toThrow()

    expect(formatClockTime(instant, clockWidget(UNKNOWN_ZONE))).toBe(
      formatClockTime(instant, clockWidget(localZone))
    )
    expect(formatClockDate(instant, UNKNOWN_ZONE)).toBe(
      formatClockDate(instant, localZone)
    )
    // The name follows the time: it says where the clock is actually reading from, rather than lending the bad string the look of a real abbreviation.
    expect(formatTimeZoneName(instant, UNKNOWN_ZONE)).toBe(
      formatTimeZoneName(instant, localZone)
    )
  })

  it("reads the system clock when the zone is left empty", () => {
    expect(formatClockTime(instant, clockWidget(""))).toBe(
      formatClockTime(instant, clockWidget(localZone))
    )
    expect(formatClockDate(instant, "")).toBe(
      formatClockDate(instant, localZone)
    )
    expect(formatTimeZoneName(instant, "")).toBe(
      formatTimeZoneName(instant, localZone)
    )
  })

  it("tells a known zone from an unknown one", () => {
    expect(isKnownTimeZone("UTC")).toBe(true)
    expect(isKnownTimeZone("Asia/Tokyo")).toBe(true)
    expect(isKnownTimeZone(UNKNOWN_ZONE)).toBe(false)
    expect(isKnownTimeZone("")).toBe(false)
  })
})

describe("resolveCountdown", () => {
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
    // Noon on the 19th is past the 19th's 9am, so the next one is the 20th.
    const target = new Date(2026, 5, 17, 9, 0, 0).toISOString()

    expect(nextCountdownTarget(target, "daily", now)).toBe(
      new Date(2026, 5, 20, 9, 0, 0).toISOString()
    )
  })

  it("keeps a daily target on its wall-clock time across a DST change", () => {
    // America/Chicago springs forward on 2026-03-08, so that day is 23 hours long: stepping by a fixed 24 hours would land the next occurrence at 10am.
    const target = new Date(2026, 2, 7, 9, 0, 0).toISOString()

    expect(
      nextCountdownTarget(target, "daily", new Date(2026, 2, 9, 12, 0, 0))
    ).toBe(new Date(2026, 2, 10, 9, 0, 0).toISOString())
  })

  it("rolls a weekly target to the same weekday within a week", () => {
    // A Monday, rolled on from a Friday to the Monday after.
    const target = new Date(2026, 4, 4, 8, 0, 0).toISOString()

    expect(nextCountdownTarget(target, "weekly", now)).toBe(
      new Date(2026, 5, 22, 8, 0, 0).toISOString()
    )
  })

  it("rolls a yearly target to the same month and day in the coming year", () => {
    const target = new Date(2025, 11, 25, 9, 0, 0).toISOString()

    expect(nextCountdownTarget(target, "yearly", now)).toBe(
      new Date(2026, 11, 25, 9, 0, 0).toISOString()
    )
  })

  it("rolls an hourly target to its minute in the coming hour", () => {
    // Years of missed occurrences resolve in one step rather than iterating.
    const target = new Date(2024, 0, 1, 8, 30, 0).toISOString()

    expect(nextCountdownTarget(target, "hourly", now)).toBe(
      new Date(2026, 5, 19, 12, 30, 0).toISOString()
    )
  })

  it("moves a target that lands exactly on now on to the next occurrence", () => {
    // The boundary belongs to the next cycle: at the instant of an occurrence, the card is already counting toward the one after it.
    const target = new Date(2026, 5, 18, 12, 0, 0).toISOString()

    expect(nextCountdownTarget(target, "daily", now)).toBe(
      new Date(2026, 5, 20, 12, 0, 0).toISOString()
    )
  })

  it("leaves an unreadable target alone rather than resolving it", () => {
    // Stepping an Invalid Date forward would throw on toISOString, so the widget has
    // to come back untouched and let the card report the problem instead.
    const unreadable = countdownWidget("not a date", { repeat: "daily" })

    expect(resolveCountdown(unreadable, now)).toBe(unreadable)
    expect(resolveCountdown(unreadable, now).settings.targetAt).toBe("not a date")
  })

  it("moves a repeating span's start with its target so the bar keeps its length", () => {
    const widget = countdownWidget(new Date(2026, 5, 17, 9, 0, 0).toISOString(), {
      startAt: new Date(2026, 5, 16, 9, 0, 0).toISOString(),
      repeat: "daily"
    })

    const resolved = resolveCountdown(widget, now)
    const start = new Date(resolved.settings.startAt!).getTime()
    const target = new Date(resolved.settings.targetAt).getTime()

    expect(target).toBeGreaterThan(now.getTime())
    expect(target - start).toBe(DAY)
  })

  it("keeps a monthly target on its day number through a month too short to hold it", () => {
    // The 31st has no February to land on, and rolling the overflow forward would put this countdown on March 3.
    const target = new Date(2026, 0, 31, 9, 0, 0).toISOString()
    const february = new Date(resolveCountdown(
      countdownWidget(target, { repeat: "monthly" }),
      new Date(2026, 1, 15, 12, 0, 0)
    ).settings.targetAt)

    expect(february.getMonth()).toBe(1)
    expect(february.getDate()).toBe(28)
    expect(february.getHours()).toBe(9)

    // The clamp holds for one short month only; the day number comes back the moment a month is long enough.
    const march = new Date(resolveCountdown(
      countdownWidget(target, { repeat: "monthly" }),
      new Date(2026, 2, 15, 12, 0, 0)
    ).settings.targetAt)

    expect(march.getMonth()).toBe(2)
    expect(march.getDate()).toBe(31)
  })

  it("keeps a yearly target on February 29 in February", () => {
    const target = new Date(2024, 1, 29, 9, 0, 0).toISOString()
    const common = new Date(resolveCountdown(
      countdownWidget(target, { repeat: "yearly" }),
      new Date(2025, 0, 15, 12, 0, 0)
    ).settings.targetAt)

    expect(common.getMonth()).toBe(1)
    expect(common.getDate()).toBe(28)

    // The next leap year restores the 29th rather than staying clamped.
    const leap = new Date(resolveCountdown(
      countdownWidget(target, { repeat: "yearly" }),
      new Date(2028, 0, 15, 12, 0, 0)
    ).settings.targetAt)

    expect(leap.getMonth()).toBe(1)
    expect(leap.getDate()).toBe(29)
  })

  it("keeps hourly occurrences one real hour apart across a DST fall-back", () => {
    // America/Chicago replays 01:00-02:00 on 2026-11-01; stepping the local hour field would never land on the second pass.
    const target = new Date(2026, 10, 1, 0, 30, 0).toISOString()
    const first = new Date(resolveCountdown(
      countdownWidget(target, { repeat: "hourly" }),
      new Date(2026, 10, 1, 0, 45, 0)
    ).settings.targetAt)
    const second = new Date(resolveCountdown(
      countdownWidget(target, { repeat: "hourly" }),
      new Date(first.getTime() + 15 * 60 * 1000)
    ).settings.targetAt)

    expect(second.getTime() - first.getTime()).toBe(60 * 60 * 1000)
  })

  it("drops a start that cannot fill a span", () => {
    const backwards = countdownWidget("2026-01-11T00:00:00.000Z", {
      startAt: "2026-02-01T00:00:00.000Z"
    })

    expect(resolveCountdown(backwards, now).settings.startAt).toBeUndefined()

    const unreadable = countdownWidget("2026-01-11T00:00:00.000Z", {
      startAt: "not a date"
    })
    expect(resolveCountdown(unreadable, now).settings.startAt).toBeUndefined()
  })
})

describe("getCountdownProgress", () => {
  const progressWidget = countdownWidget("2026-01-11T00:00:00.000Z", {
    startAt: "2026-01-01T00:00:00.000Z"
  })

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

  it("reads an unreadable target as an empty bar however far the start is", () => {
    // A hand-edited or imported board can carry a target that does not parse. With no
    // end to measure against, an empty bar is the honest answer rather than a full one.
    const unreadable = countdownWidget("soon", {
      startAt: "2026-01-01T00:00:00.000Z"
    })

    expect(
      getCountdownProgress(unreadable, new Date("2027-01-01T00:00:00.000Z"))
    ).toBe(0)
  })
})

describe("getCountdownPercent", () => {
  it("rounds to the nearest percent through the middle", () => {
    expect(getCountdownPercent(0.5)).toBe(50)
    expect(getCountdownPercent(0.504)).toBe(50)
    expect(getCountdownPercent(0.506)).toBe(51)
  })

  it("holds short of the ends while any of the span is left", () => {
    expect(getCountdownPercent(0.997)).toBe(99)
    expect(getCountdownPercent(0.99999)).toBe(99)
    expect(getCountdownPercent(0.003)).toBe(1)
  })

  it("reaches the ends only when the span is complete or untouched", () => {
    expect(getCountdownPercent(1)).toBe(100)
    expect(getCountdownPercent(0)).toBe(0)
  })

  it("reads an unusable span as untouched", () => {
    expect(getCountdownPercent(Number.NaN)).toBe(0)
  })
})

describe("datetime-local countdown conversions", () => {
  it("converts a local input value into an ISO instant", () => {
    expect(dateTimeInputValueToIsoInstant("2026-01-02T03:04")).toBe(
      new Date(2026, 0, 2, 3, 4, 0, 0).toISOString()
    )
  })

  it("rejects a date or time that does not exist rather than rolling it over", () => {
    expect(dateTimeInputValueToIsoInstant("2026-02-30T10:00")).toBeNull()
    expect(dateTimeInputValueToIsoInstant("2026-13-01T10:00")).toBeNull()
    expect(dateTimeInputValueToIsoInstant("2026-00-10T10:00")).toBeNull()
    expect(dateTimeInputValueToIsoInstant("2026-04-00T10:00")).toBeNull()
    expect(dateTimeInputValueToIsoInstant("2026-04-10T24:00")).toBeNull()
    expect(dateTimeInputValueToIsoInstant("2026-04-10T10:60")).toBeNull()
  })

  it("accepts the edges of a real calendar", () => {
    expect(dateTimeInputValueToIsoInstant("2028-02-29T23:59")).toBe(
      new Date(2028, 1, 29, 23, 59, 0, 0).toISOString()
    )
    expect(dateTimeInputValueToIsoInstant("2026-02-29T00:00")).toBeNull()
  })

  it("converts an ISO instant into a datetime-local value", () => {
    expect(
      isoInstantToDateTimeInputValue(new Date(2026, 0, 2, 3, 4, 0, 0).toISOString())
    ).toBe("2026-01-02T03:04")
  })

  it("round-trips a year under 1000 through the edit field", () => {
    // A datetime-local field reads "50-01-02T03:04" as empty, which would leave the required When field blank and block saving.
    const instant = dateTimeInputValueToIsoInstant("0050-01-02T03:04")!

    expect(isoInstantToDateTimeInputValue(instant)).toBe("0050-01-02T03:04")
  })

  it("leaves the input empty for a missing or unreadable instant", () => {
    // The edit dialog runs every countdown through this to seed its field, including
    // one with no start yet, so an empty control has to be the fallback for both.
    expect(isoInstantToDateTimeInputValue("")).toBe("")
    expect(isoInstantToDateTimeInputValue("soon")).toBe("")
  })
})

describe("getCountdownParts", () => {
  it("returns the status and natural-language label for a future target", () => {
    const parts = getCountdownParts(
      countdownWidget("2026-01-02T03:04:00.000Z"),
      new Date("2026-01-01T00:00:00.000Z")
    )

    expect(parts.status).toBe("future")
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

  it("reads an unreadable target as due rather than failing", () => {
    const parts = getCountdownParts(
      countdownWidget("soon"),
      new Date("2026-01-01T00:00:00.000Z")
    )

    expect(parts.status).toBe("due")
    expect(parts.label).toBe("less than a minute from now")
  })
})

describe("formatCountdownTarget", () => {
  it("says so plainly when the stored target cannot be read", () => {
    // The only signal a corrupt countdown gives, since the relative label above reads
    // as an ordinary imminent one.
    expect(formatCountdownTarget(countdownWidget("soon"))).toBe("Invalid target")
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

  it("flips to counted minutes exactly at one minute", () => {
    expect(formatRelativeCountdown(59_999)).toBe("less than a minute from now")
    expect(formatRelativeCountdown(60_000)).toBe("1 minute from now")
    expect(formatRelativeCountdown(-59_999)).toBe("just now")
    expect(formatRelativeCountdown(-60_000)).toBe("1 minute ago")
  })

  it("treats the moment itself and an unreadable span as imminent", () => {
    expect(formatRelativeCountdown(0)).toBe("less than a minute from now")
    expect(formatRelativeCountdown(Number.NaN)).toBe("less than a minute from now")
  })

  it("skips an empty unit instead of leaving a gap", () => {
    // Two days and nine minutes has no hours to show, and the minutes take the second
    // slot rather than the card reading "2 days, 0 hours".
    expect(formatRelativeCountdown(2 * 86_400_000)).toBe("2 days from now")
    expect(formatRelativeCountdown(2 * 86_400_000 + 9 * 60_000)).toBe(
      "2 days, 9 minutes from now"
    )
  })
})
