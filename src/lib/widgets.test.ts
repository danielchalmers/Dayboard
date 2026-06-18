import { describe, expect, it } from "vitest"

import { moveWidget, moveWidgetToIndex, reorderWidgets, createWidget as createActualWidget } from "./widgets"
import type { Widget } from "./types"

const createWidget = (id: string, title: string): Widget => ({
  id,
  kind: "clock",
  title,
  colorPreset: "slate",
  settings: {
    timeZone: "UTC"
  }
})

describe("createWidget", () => {
  it("initializes a widget with the default slate color preset", () => {
    const clock = createActualWidget("clock")
    const countdown = createActualWidget("countdown")
    
    expect(clock.colorPreset).toBe("slate")
    expect(countdown.colorPreset).toBe("slate")
  })
})

describe("moveWidgetToIndex", () => {
  it("moves an item from one index to another", () => {
    const widgets = [
      createWidget("alpha", "Alpha"),
      createWidget("beta", "Beta"),
      createWidget("gamma", "Gamma")
    ]

    expect(moveWidgetToIndex(widgets, 0, 2).map((widget) => widget.id)).toEqual([
      "beta",
      "gamma",
      "alpha"
    ])
  })

  it("keeps the same list reference when the target index is unchanged", () => {
    const widgets = [createWidget("alpha", "Alpha"), createWidget("beta", "Beta")]

    expect(moveWidgetToIndex(widgets, 1, 1)).toBe(widgets)
  })
})

describe("reorderWidgets", () => {
  it("returns the original list for invalid widget ids", () => {
    const widgets = [createWidget("alpha", "Alpha"), createWidget("beta", "Beta")]

    expect(reorderWidgets(widgets, "missing", "beta")).toBe(widgets)
    expect(reorderWidgets(widgets, "alpha", "missing")).toBe(widgets)
  })
})

describe("moveWidget", () => {
  it("returns the original list when a move would leave the list unchanged", () => {
    const widgets = [createWidget("alpha", "Alpha"), createWidget("beta", "Beta")]

    expect(moveWidget(widgets, "alpha", -1)).toBe(widgets)
  })
})
