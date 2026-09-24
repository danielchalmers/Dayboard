// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { ItemDialog } from "./ItemDialog"
import type { CountdownWidget, Widget } from "~/lib/types"

const clockItem: Widget = {
  id: "clock-1",
  kind: "clock",
  title: "Local time",
  colorPreset: "slate",
  settings: { timeZone: "UTC" }
}

const timerItem: Widget = {
  id: "timer-1",
  kind: "timer",
  title: "Tea",
  colorPreset: "slate",
  settings: {
    durationMs: 60_000,
    running: false,
    remainingMs: 60_000,
    endsAt: null,
    chime: false
  }
}

const quoteItem: Widget = {
  id: "quote-1",
  kind: "quote",
  title: "Mantras",
  colorPreset: "slate",
  settings: {
    quotes: ["One small thing, done well."],
    rotation: "daily"
  }
}

const countdownItem: CountdownWidget = {
  id: "countdown-1",
  kind: "countdown",
  title: "Launch",
  colorPreset: "slate",
  settings: {
    targetAt: new Date(2026, 0, 2, 9, 0, 0).toISOString(),
    startAt: new Date(2026, 0, 1, 9, 0, 0).toISOString()
  }
}

// An open clock in edit mode with inert callbacks, so each test names only the props it actually cares about.
const itemDialog = (props: Partial<ComponentProps<typeof ItemDialog>> = {}) => (
  <ItemDialog
    isOpen
    item={clockItem}
    mode="edit"
    onClose={() => {}}
    onSave={() => {}}
    {...props}
  />
)

const saved = (onSave: ReturnType<typeof vi.fn>) => onSave.mock.calls[0]![0]

// Fields are labelled either by the span inside their wrapping label or by an aria-label, and this test cares about the roster of fields rather than any one of them.
const fieldName = (field: Element) =>
  field.getAttribute("aria-label") ??
  field.closest("label")?.querySelector("span")?.textContent

describe("ItemDialog", () => {
  it("saves the current edit when the backdrop is clicked", () => {
    const onSave = vi.fn()
    const onClose = vi.fn()

    render(itemDialog({ onClose, onSave }))

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Berlin" }
    })

    const backdrop = document.querySelector(".modal-backdrop") as HTMLElement
    fireEvent.pointerDown(backdrop)

    // Clicking the backdrop commits the edit rather than discarding it.
    expect(onClose).not.toHaveBeenCalled()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(saved(onSave)).toMatchObject({ id: "clock-1", title: "Berlin" })
  })

  // The backdrop commits rather than discards, so it has to answer to the same validation the Save button does.
  // Otherwise the easiest way out of the dialog is also the one that saves a nameless card, which then sits on the board with no heading to find it by.
  it("will not commit a nameless item from the backdrop", () => {
    const onSave = vi.fn()
    const onClose = vi.fn()

    render(itemDialog({ onClose, onSave }))

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "" } })

    const backdrop = document.querySelector(".modal-backdrop") as HTMLElement
    fireEvent.pointerDown(backdrop)

    // Native validation blocks the submit, so the dialog stays open with the edit still in it.
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toBeRequired()
  })

  it("will not save a timer with no length", () => {
    const onSave = vi.fn()

    render(itemDialog({ item: timerItem, onSave }))

    fireEvent.change(screen.getByLabelText("minutes"), { target: { value: "0" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    // A zero length would finish on save, then read back from storage as the default five minutes.
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByLabelText("hours")).toBeInvalid()

    fireEvent.change(screen.getByLabelText("seconds"), { target: { value: "30" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(saved(onSave).settings.durationMs).toBe(30_000)
  })

  it("closes on Escape without saving, even when opened by a prop change", () => {
    const onClose = vi.fn()
    const onSave = vi.fn()

    // Mount closed, then open it the way the app does, flipping isOpen and supplying the item together, so the focus/Escape wiring has to survive the draft being adopted on open.
    const { rerender } = render(
      itemDialog({ isOpen: false, item: null, mode: "add", onClose, onSave })
    )
    rerender(itemDialog({ onClose, onSave }))

    const dialog = screen.getByRole("dialog")
    // Focus moved into the dialog, proving the modal focus hook wired up.
    expect(dialog.contains(document.activeElement)).toBe(true)

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Discarded" }
    })
    fireEvent.keyDown(dialog, { key: "Escape" })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it("toggles the per-timer chime and saves it", () => {
    const onSave = vi.fn()

    render(itemDialog({ item: timerItem, onSave }))

    const chime = screen.getByRole("switch", { name: "Chime when it ends" })
    expect(chime).not.toBeChecked()

    fireEvent.click(chime)
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(saved(onSave).settings.chime).toBe(true)
  })

  it("edits a clock's time zone", () => {
    const onSave = vi.fn()

    render(itemDialog({ onSave }))

    fireEvent.change(screen.getByLabelText("Time zone"), {
      target: { value: "Europe/Berlin" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(saved(onSave).settings.timeZone).toBe("Europe/Berlin")
  })

  it("clears a clock's time zone so it follows the system clock", () => {
    const onSave = vi.fn()

    render(itemDialog({ onSave }))

    const field = screen.getByLabelText("Time zone")
    // No zone is a real choice (the system clock), so the field must not demand one.
    expect(field).not.toBeRequired()

    fireEvent.change(field, { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(saved(onSave).settings.timeZone).toBe("")
  })

  // A clock reads the system's own hour format, so an editor that offered seconds or a 12/24-hour choice would be a knob with nothing behind it.
  it("offers no seconds or hour-format knobs on a clock", () => {
    render(itemDialog())

    expect(screen.getAllByRole("textbox").map(fieldName)).toEqual(["Name"])
    // A native select would answer to combobox too, which is how an hour-format dropdown would show up here.
    expect(screen.getAllByRole("combobox").map(fieldName)).toEqual([
      "Time zone"
    ])
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("recolors an item from the preset picker", () => {
    const onSave = vi.fn()

    render(itemDialog({ onSave }))

    const group = screen.getByRole("radiogroup", { name: "Widget color" })
    expect(within(group).getByRole("radio", { name: "Slate" })).toBeChecked()

    // The curated swatches are the whole color surface: no free color input and no hex box beside them.
    expect(
      screen.getByRole("dialog").querySelector('input[type="color"]')
    ).toBeNull()
    expect(screen.queryByRole("textbox", { name: /colou?r|hex/i })).toBeNull()

    fireEvent.click(within(group).getByRole("radio", { name: "Rose" }))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(saved(onSave).colorPreset).toBe("rose")
  })

  it("rewrites a quote list without disturbing its rotation", () => {
    const onSave = vi.fn()

    render(itemDialog({ item: quoteItem, onSave }))

    fireEvent.change(screen.getByLabelText("Quotes (one per line)"), {
      target: { value: "Begin where you are.\nQuiet days still count." }
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(saved(onSave).settings.quotes).toEqual([
      "Begin where you are.",
      "Quiet days still count."
    ])
    expect(saved(onSave).settings.rotation).toBe("daily")
  })

  it("changes a quote's rotation without disturbing its list", () => {
    const onSave = vi.fn()

    render(itemDialog({ item: quoteItem, onSave }))

    fireEvent.change(screen.getByLabelText("Show a new one"), {
      target: { value: "open" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(saved(onSave).settings.rotation).toBe("open")
    expect(saved(onSave).settings.quotes).toEqual(quoteItem.settings.quotes)
  })

  it("clears a countdown's start so the card drops the progress bar", () => {
    const onSave = vi.fn()

    render(itemDialog({ item: countdownItem, onSave }))

    expect(screen.getByLabelText("Starting from")).toHaveValue("2026-01-01T09:00")

    fireEvent.change(screen.getByLabelText("Starting from"), {
      target: { value: "" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(saved(onSave).settings.startAt).toBeUndefined()
    // Clearing the start must not disturb the target.
    expect(saved(onSave).settings.targetAt).toBe(countdownItem.settings.targetAt)
  })

  it("clears a countdown's start from the field's clear button", () => {
    const onSave = vi.fn()

    render(itemDialog({ item: countdownItem, onSave }))

    expect(screen.getByLabelText("Starting from")).toHaveValue("2026-01-01T09:00")

    fireEvent.click(screen.getByRole("button", { name: "Clear starting from" }))

    expect(screen.getByLabelText("Starting from")).toHaveValue("")
    // With nothing left to clear, the button steps out of the way.
    expect(
      screen.queryByRole("button", { name: "Clear starting from" })
    ).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(saved(onSave).settings.startAt).toBeUndefined()
    // Clearing the start must not disturb the target.
    expect(saved(onSave).settings.targetAt).toBe(countdownItem.settings.targetAt)
  })

  it("keeps an hourly repeat on a countdown", () => {
    const onSave = vi.fn()

    render(itemDialog({ item: countdownItem, onSave }))

    fireEvent.change(screen.getByLabelText("Repeats"), {
      target: { value: "hourly" }
    })
    // Moving the target must leave the span's start (and the bar) alone.
    fireEvent.change(screen.getByLabelText("When"), {
      target: { value: "2026-01-03T09:00" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(saved(onSave).settings.repeat).toBe("hourly")
    expect(saved(onSave).settings.startAt).toBe(countdownItem.settings.startAt)
  })

  it("ignores clicks that land inside the dialog", () => {
    const onSave = vi.fn()
    const onClose = vi.fn()

    render(itemDialog({ onClose, onSave }))

    // A pointer down on the dialog surface itself must not save or close.
    fireEvent.pointerDown(screen.getByRole("dialog"))

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
