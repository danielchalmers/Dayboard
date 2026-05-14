import { describe, expect, it } from "vitest"

import {
  formatCountdownLabel,
  getCountdownParts,
  zonedDateTimeToUtcMs
} from "./time"
import type { CountdownItem } from "./types"

const countdownItem = (targetDateTime: string): CountdownItem => ({
  id: "launch",
  kind: "countdown",
  title: "Launch",
  timeZone: "UTC",
  color: "#0f9f8f",
  targetDateTime,
  showSeconds: true,
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
    expect(parts.label).toBe("1d 03h 04m 00s")
  })

  it("marks past targets as due", () => {
    const parts = getCountdownParts(
      countdownItem("2026-01-01T00:00"),
      new Date("2026-01-01T00:01:00.000Z")
    )

    expect(parts.status).toBe("due")
    expect(parts.label).toBe("0d 00h 00m 00s")
  })
})

describe("formatCountdownLabel", () => {
  it("omits seconds when configured", () => {
    expect(
      formatCountdownLabel(
        { days: 2, hours: 5, minutes: 9, seconds: 30 },
        false
      )
    ).toBe("2d 05h 09m")
  })
})
