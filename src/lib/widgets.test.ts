import { describe, expect, it } from "vitest"

import {
  archiveWidget,
  createWidget as createActualWidget,
  moveActiveWidget,
  moveWidgetToIndex,
  reorderWidgets,
  restoreWidget
} from "./widgets"
import { COLOR_PRESETS } from "./colors"
import type { Widget } from "./types"

const createWidget = (
  id: string,
  title: string,
  archived = false
): Widget => ({
  id,
  kind: "clock",
  title,
  colorPreset: "slate",
  archived,
  settings: {
    timeZone: "UTC"
  }
})

describe("createWidget", () => {
  it("preselects a random colorful preset — never the neutral slate", () => {
    const presets = Array.from({ length: 40 }, () =>
      createActualWidget("clock").colorPreset
    )

    presets.forEach((preset) => {
      expect(COLOR_PRESETS.some(({ id }) => id === preset)).toBe(true)
      expect(preset).not.toBe("slate")
    })

    // 40 draws over 11 hues collide on a single value with probability ~0, so seeing variety proves the pick is actually random.
    expect(new Set(presets).size).toBeGreaterThan(1)
  })

  it("leaves a new clock's zone empty, so it follows the system clock", () => {
    expect(createActualWidget("clock").settings.timeZone).toBe("")
  })

  it("leaves a new countdown's start empty, so the card shows time remaining", () => {
    const now = new Date(2026, 5, 19, 12, 34, 0)
    const countdown = createActualWidget("countdown", now)

    // A start is what makes the card a progress bar, and that is opt-in from the dialog's Starting from field rather than pre-filled.
    expect(countdown.settings.startAt).toBeUndefined()
    // The target defaults to the top of the coming hour.
    expect(countdown.settings.targetAt).toBe(
      new Date(2026, 5, 19, 13, 0, 0).toISOString()
    )
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

  it("keeps the same list reference for an index off either end", () => {
    const widgets = [createWidget("alpha", "Alpha"), createWidget("beta", "Beta")]

    expect(moveWidgetToIndex(widgets, -1, 0)).toBe(widgets)
    expect(moveWidgetToIndex(widgets, 0, -1)).toBe(widgets)
    expect(moveWidgetToIndex(widgets, 2, 0)).toBe(widgets)
    expect(moveWidgetToIndex(widgets, 0, 2)).toBe(widgets)
  })
})

describe("reorderWidgets", () => {
  const widgets = [
    createWidget("alpha", "Alpha"),
    createWidget("beta", "Beta"),
    createWidget("gamma", "Gamma")
  ]

  // A drop takes the slot of the card it lands on, from either direction, the way dnd-kit's sortable preview has already shown it.
  it("drops a card into the slot of the one it lands on", () => {
    expect(reorderWidgets(widgets, "alpha", "gamma").map((w) => w.id)).toEqual([
      "beta",
      "gamma",
      "alpha"
    ])
    expect(reorderWidgets(widgets, "gamma", "alpha").map((w) => w.id)).toEqual([
      "gamma",
      "alpha",
      "beta"
    ])
  })

  it("returns the original list for invalid widget ids or a drop onto itself", () => {
    expect(reorderWidgets(widgets, "missing", "beta")).toBe(widgets)
    expect(reorderWidgets(widgets, "alpha", "missing")).toBe(widgets)
    expect(reorderWidgets(widgets, "beta", "beta")).toBe(widgets)
  })
})

describe("moveActiveWidget", () => {
  it("moves an active widget up among the visible widgets", () => {
    const widgets = [
      createWidget("alpha", "Alpha"),
      createWidget("beta", "Beta"),
      createWidget("gamma", "Gamma")
    ]

    expect(moveActiveWidget(widgets, "gamma", -1).map((w) => w.id)).toEqual([
      "alpha",
      "gamma",
      "beta"
    ])
  })

  it("moves an active widget down among the visible widgets", () => {
    const widgets = [
      createWidget("alpha", "Alpha"),
      createWidget("beta", "Beta"),
      createWidget("gamma", "Gamma")
    ]

    expect(moveActiveWidget(widgets, "alpha", 1).map((w) => w.id)).toEqual([
      "beta",
      "alpha",
      "gamma"
    ])
  })

  it("reorders against the visible neighbor, skipping interleaved archived widgets", () => {
    // "delta" was added after "charlie" was archived, so it sits past the archived widget in storage.
    // Moving it up must step over the hidden archived widget and land above the previous *visible* widget.
    const widgets = [
      createWidget("alpha", "Alpha"),
      createWidget("beta", "Beta"),
      createWidget("charlie", "Charlie", true),
      createWidget("delta", "Delta")
    ]

    const moved = moveActiveWidget(widgets, "delta", -1)

    // Full storage order keeps the archived widget; delta hops above beta.
    expect(moved.map((w) => w.id)).toEqual([
      "alpha",
      "delta",
      "beta",
      "charlie"
    ])
    // What the board shows (the active widgets) reflects the move.
    expect(moved.filter((w) => !w.archived).map((w) => w.id)).toEqual([
      "alpha",
      "delta",
      "beta"
    ])
  })

  it("leaves the list unchanged at the visible edges or for unknown ids", () => {
    const widgets = [
      createWidget("alpha", "Alpha"),
      createWidget("beta", "Beta", true)
    ]

    expect(moveActiveWidget(widgets, "alpha", -1)).toBe(widgets)
    expect(moveActiveWidget(widgets, "alpha", 1)).toBe(widgets)
    expect(moveActiveWidget(widgets, "missing", -1)).toBe(widgets)
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
    const archived = archiveWidget(widgets, "alpha")

    expect(archiveWidget(widgets, "missing")).toBe(widgets)
    expect(archiveWidget(archived, "alpha")).toBe(archived)
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

  it("leaves the list untouched when restoring an unknown or non-archived widget", () => {
    expect(restoreWidget(widgets, "alpha")).toBe(widgets)
    expect(restoreWidget(widgets, "missing")).toBe(widgets)
  })

  it("restores into the slot of the board card it was dropped on", () => {
    const archived = archiveWidget(widgets, "gamma")
    const restored = restoreWidget(archived, "gamma", "alpha")

    // Dropped onto "alpha", so it takes alpha's slot and pushes it down.
    expect(restored.map((widget) => widget.id)).toEqual([
      "gamma",
      "alpha",
      "beta"
    ])
    expect(restored.every((widget) => !widget.archived)).toBe(true)
  })

  it("falls back to the end of the board when the drop target is unknown or archived", () => {
    const archived = archiveWidget(archiveWidget(widgets, "beta"), "gamma")

    expect(
      restoreWidget(archived, "gamma", "missing").map((widget) => widget.id)
    ).toEqual(["alpha", "gamma", "beta"])
    // Another archived card is not a board slot; it cannot anchor the restore.
    expect(
      restoreWidget(archived, "gamma", "beta").map((widget) => widget.id)
    ).toEqual(["alpha", "gamma", "beta"])
  })
})
