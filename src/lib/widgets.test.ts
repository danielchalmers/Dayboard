import { describe, expect, it } from "vitest"

import {
  getWidgetsByPlacement,
  moveWidget,
  moveWidgetToIndex,
  moveWidgetToPlacement,
  reorderWidgets,
  reorderWidgetsInPlacement
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

describe("getWidgetsByPlacement", () => {
  it("returns only widgets in the requested section", () => {
    const widgets = [
      createWidget("alpha", "Alpha", "main"),
      createWidget("beta", "Beta", "more"),
      createWidget("gamma", "Gamma", "main")
    ]

    expect(getWidgetsByPlacement(widgets, "main").map((widget) => widget.id)).toEqual([
      "alpha",
      "gamma"
    ])
    expect(getWidgetsByPlacement(widgets, "more").map((widget) => widget.id)).toEqual([
      "beta"
    ])
  })
})

describe("moveWidgetToPlacement", () => {
  it("moves a widget from Main to More without changing its other data", () => {
    const widgets = [
      createWidget("alpha", "Alpha", "main"),
      createWidget("beta", "Beta", "main"),
      createWidget("gamma", "Gamma", "more")
    ]

    const movedWidgets = moveWidgetToPlacement(widgets, "beta", "more")

    expect(movedWidgets).toEqual([
      createWidget("alpha", "Alpha", "main"),
      createWidget("gamma", "Gamma", "more"),
      createWidget("beta", "Beta", "more")
    ])
  })

  it("moves a widget from More to Main without changing its other data", () => {
    const widgets = [
      createWidget("alpha", "Alpha", "main"),
      createWidget("beta", "Beta", "more"),
      createWidget("gamma", "Gamma", "more")
    ]

    const movedWidgets = moveWidgetToPlacement(widgets, "beta", "main")

    expect(movedWidgets).toEqual([
      createWidget("alpha", "Alpha", "main"),
      createWidget("beta", "Beta", "main"),
      createWidget("gamma", "Gamma", "more")
    ])
  })
})

describe("reorderWidgetsInPlacement", () => {
  it("reordering Main does not reorder More", () => {
    const widgets = [
      createWidget("alpha", "Alpha", "main"),
      createWidget("beta", "Beta", "main"),
      createWidget("gamma", "Gamma", "more"),
      createWidget("delta", "Delta", "more")
    ]

    expect(
      reorderWidgetsInPlacement(widgets, "main", "beta", "alpha").map(
        (widget) => `${widget.placement}:${widget.id}`
      )
    ).toEqual(["main:beta", "main:alpha", "more:gamma", "more:delta"])
  })

  it("reordering More does not reorder Main", () => {
    const widgets = [
      createWidget("alpha", "Alpha", "main"),
      createWidget("beta", "Beta", "main"),
      createWidget("gamma", "Gamma", "more"),
      createWidget("delta", "Delta", "more")
    ]

    expect(
      reorderWidgetsInPlacement(widgets, "more", "delta", "gamma").map(
        (widget) => `${widget.placement}:${widget.id}`
      )
    ).toEqual(["main:alpha", "main:beta", "more:delta", "more:gamma"])
  })
})
