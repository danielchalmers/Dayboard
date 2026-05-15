import { describe, expect, it } from "vitest"

import { migrateClockboardState } from "./storage"

describe("migrateClockboardState", () => {
  it("falls back to default widgets for missing or invalid state", () => {
    const missingState = migrateClockboardState(undefined)
    const invalidState = migrateClockboardState({ version: 2, widgets: [] })

    expect(missingState.version).toBe(2)
    expect(missingState.widgets).toHaveLength(2)
    expect(missingState.widgets.map((widget) => widget.kind)).toEqual([
      "clock",
      "countdown"
    ])
    expect(invalidState.widgets).toHaveLength(2)
  })

  it("migrates v1 items into v2 widgets and drops legacy settings", () => {
    const migrated = migrateClockboardState({
      version: 1,
      settings: {
        boardTitle: "My board",
        showDate: false
      },
      items: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Paris",
          timeZone: "Europe/Paris",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        },
        {
          id: "countdown-1",
          kind: "countdown",
          title: "Launch",
          timeZone: "America/New_York",
          targetDateTime: "2026-01-01T09:30",
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-04T00:00:00.000Z"
        }
      ]
    })

    expect(migrated).toEqual({
      version: 2,
      widgets: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Paris",
          placement: "main",
          settings: {
            timeZone: "Europe/Paris"
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        },
        {
          id: "countdown-1",
          kind: "countdown",
          title: "Launch",
          placement: "main",
          settings: {
            targetAt: "2026-01-01T14:30:00.000Z"
          },
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-04T00:00:00.000Z"
        }
      ]
    })
    expect(migrated).not.toHaveProperty("settings")
    expect(migrated.widgets[1]?.settings).not.toHaveProperty("timeZone")
  })

  it("sanitizes existing v2 widgets", () => {
    const migrated = migrateClockboardState({
      version: 2,
      settings: {
        boardTitle: "Legacy",
        showDate: true
      },
      widgets: [
        {
          id: "clock-1",
          kind: "clock",
          title: "Clock",
          placement: "somewhere",
          settings: {
            timeZone: ""
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        },
        {
          id: "countdown-1",
          kind: "countdown",
          title: "Countdown",
          placement: "more",
          settings: {
            targetAt: "not-an-instant"
          },
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-04T00:00:00.000Z"
        }
      ]
    })

    expect(migrated.version).toBe(2)
    expect(migrated.widgets[0]).toMatchObject({
      id: "clock-1",
      kind: "clock",
      placement: "main",
      title: "Clock",
      settings: {
        timeZone: expect.any(String)
      }
    })
    expect(migrated.widgets[1]).toMatchObject({
      id: "countdown-1",
      kind: "countdown",
      placement: "more",
      title: "Countdown",
      settings: {
        targetAt: expect.stringMatching(/Z$/)
      }
    })
    expect(migrated).not.toHaveProperty("settings")
  })
})
