import { describe, expect, it } from "vitest"

import {
  getWidgetsByPlacement,
  moveWidget,
  moveWidgetToIndex,
  moveWidgetToPlacement,
  moveWidgetWithinPlacement,
  reorderWidgets,
  reorderWidgetsWithinPlacement
} from "./widgets"
import type { Widget } from "./types"

const createWidget = (
  id: string,
  title: string,
  placement: Widget["placement"] = "main"
): Widget => ({
  id,
  kind: "clock",
  title,
  placement,
  settings: {
    timeZone: "UTC"
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
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

describe("widget placement helpers", () => {
  it("groups widgets by placement", () => {
    const widgets = [
      createWidget("alpha", "Alpha"),
      createWidget("beta", "Beta", "more")
    ]

    expect(getWidgetsByPlacement(widgets, "main").map((widget) => widget.id)).toEqual([
      "alpha"
    ])
    expect(getWidgetsByPlacement(widgets, "more").map((widget) => widget.id)).toEqual([
      "beta"
    ])
  })

  it("moves a widget to the end of the target placement", () => {
    const widgets = [
      createWidget("alpha", "Alpha"),
      createWidget("beta", "Beta", "more"),
      createWidget("gamma", "Gamma")
    ]

    const nextWidgets = moveWidgetToPlacement(widgets, "alpha", "more")

    expect(nextWidgets.map((widget) => `${widget.id}:${widget.placement}`)).toEqual([
      "gamma:main",
      "beta:more",
      "alpha:more"
    ])
  })

  it("reorders only within a widget placement", () => {
    const widgets = [
      createWidget("alpha", "Alpha"),
      createWidget("beta", "Beta", "more"),
      createWidget("gamma", "Gamma"),
      createWidget("delta", "Delta", "more")
    ]

    expect(
      moveWidgetWithinPlacement(widgets, "gamma", -1).map((widget) => widget.id)
    ).toEqual(["gamma", "alpha", "beta", "delta"])

    expect(
      reorderWidgetsWithinPlacement(widgets, "delta", "beta").map(
        (widget) => widget.id
      )
    ).toEqual(["alpha", "gamma", "delta", "beta"])

    expect(reorderWidgetsWithinPlacement(widgets, "alpha", "beta")).toBe(widgets)
  })
})
