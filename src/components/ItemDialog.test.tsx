import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ItemDialog } from "./ItemDialog"
import type { Widget } from "~/lib/types"

const clockItem: Widget = {
  id: "clock-1",
  kind: "clock",
  title: "Local time",
  colorPreset: "slate",
  settings: { timeZone: "UTC" }
}

describe("ItemDialog", () => {
  it("saves the current edit when the backdrop is clicked", () => {
    const onSave = vi.fn()
    const onClose = vi.fn()

    render(
      <ItemDialog
        isOpen
        item={clockItem}
        mode="edit"
        onClose={onClose}
        onSave={onSave}
      />
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Berlin" }
    })

    const backdrop = document.querySelector(".modal-backdrop") as HTMLElement
    fireEvent.pointerDown(backdrop)

    // Clicking the backdrop commits the edit rather than discarding it.
    expect(onClose).not.toHaveBeenCalled()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      id: "clock-1",
      title: "Berlin"
    })
  })

  it("closes on Escape without saving, even when opened by a prop change", () => {
    const onClose = vi.fn()
    const onSave = vi.fn()

    // Mount closed, then open it the way the app does — flipping isOpen and
    // supplying the item together — so the focus/Escape wiring has to survive
    // the draft being adopted on open.
    const { rerender } = render(
      <ItemDialog
        isOpen={false}
        item={null}
        mode="add"
        onClose={onClose}
        onSave={onSave}
      />
    )
    rerender(
      <ItemDialog
        isOpen
        item={clockItem}
        mode="edit"
        onClose={onClose}
        onSave={onSave}
      />
    )

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

  it("ignores clicks that land inside the dialog", () => {
    const onSave = vi.fn()
    const onClose = vi.fn()

    render(
      <ItemDialog
        isOpen
        item={clockItem}
        mode="edit"
        onClose={onClose}
        onSave={onSave}
      />
    )

    // A pointer down on the dialog surface itself must not save or close.
    fireEvent.pointerDown(screen.getByRole("dialog"))

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
