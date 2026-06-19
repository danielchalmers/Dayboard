import { describe, expect, it } from "vitest"

import {
  archiveWidget,
  createWidget as createActualWidget,
  moveWidget,
  moveWidgetToIndex,
  reorderWidgets,
  restoreWidget
} from "./widgets"
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

describe("archiveWidget / restoreWidget", () => {
  const widgets = [
    createWidget("alpha", "Alpha"),
    createWidget("beta", "Beta"),
    createWidget("gamma", "Gamma")
  ]

  it("archives a widget and moves it to the end", () => {
    const result = archiveWidget(widgets, "alpha")

    expect(result.map((widget) => widget.id)).toEqual(["beta", "gamma", "alpha"])
    expect(result.find((widget) => widget.id === "alpha")?.archived).toBe(true)
    expect(result.find((widget) => widget.id === "beta")?.archived).toBeFalsy()
  })

  it("leaves the list untouched for an unknown or already-archived widget", () => {
    expect(archiveWidget(widgets, "missing")).toBe(widgets)
    expect(archiveWidget(archiveWidget(widgets, "alpha"), "alpha")).toEqual(
      archiveWidget(widgets, "alpha")
    )
  })

  it("restores a widget back after the last active one", () => {
    const archived = archiveWidget(widgets, "alpha")
    const restored = restoreWidget(archived, "alpha")

    expect(restored.map((widget) => widget.id)).toEqual([
      "beta",
      "gamma",
      "alpha"
    ])
    expect(restored.every((widget) => !widget.archived)).toBe(true)
  })

  it("leaves the list untouched when restoring a non-archived widget", () => {
    expect(restoreWidget(widgets, "alpha")).toBe(widgets)
  })
})
