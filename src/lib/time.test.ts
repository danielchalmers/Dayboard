import { describe, expect, it } from "vitest"

import {
  formatRelativeCountdown,
  getCountdownParts,
  zonedDateTimeToUtcMs
} from "./time"
import type { CountdownItem } from "./types"

const countdownItem = (targetDateTime: string): CountdownItem => ({
  id: "launch",
  kind: "countdown",
  title: "Launch",
  timeZone: "UTC",
  targetDateTime,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
})

describe("zonedDateTimeToUtcMs", () => {
  it("keeps UTC local datetime unchanged", () => {
    expect(zonedDateTimeToUtcMs("2026-01-01T09:30", "UTC")).toBe(
      Date.UTC(2026, 0, 1, 9, 30, 0)
    )
  })

  it("converts a zoned New York datetime into UTC", () => {
    expect(
      zonedDateTimeToUtcMs("2026-01-01T09:30", "America/New_York")
    ).toBe(Date.UTC(2026, 0, 1, 14, 30, 0))
  })
})

describe("getCountdownParts", () => {
  it("returns remaining time parts for a future target", () => {
    const parts = getCountdownParts(
      countdownItem("2026-01-02T03:04"),
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
      countdownItem("2026-01-01T00:00"),
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
