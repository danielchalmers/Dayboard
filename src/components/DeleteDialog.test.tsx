// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { DeleteDialog } from "./DeleteDialog"
import type { Widget } from "~/lib/types"

const noteItem: Widget = {
  id: "note-1",
  kind: "note",
  title: "Groceries",
  colorPreset: "slate",
  settings: { text: "Milk" }
}

// An open dialog over an active note with inert callbacks, so each test names only the props it actually cares about.
const deleteDialog = (
  props: Partial<ComponentProps<typeof DeleteDialog>> = {}
) => (
  <DeleteDialog
    isOpen
    item={noteItem}
    onCancel={() => {}}
    onConfirm={() => {}}
    {...props}
  />
)

describe("DeleteDialog", () => {
  it("renders nothing without an open item", () => {
    const { container, rerender } = render(deleteDialog({ isOpen: false }))
    expect(container).toBeEmptyDOMElement()

    // The board clears the pending item before the dialog closes, so an open dialog with nothing to delete has to stay silent too.
    rerender(deleteDialog({ item: null }))
    expect(container).toBeEmptyDOMElement()
  })

  it("names the action and the kind rather than the widget", () => {
    render(deleteDialog())

    expect(
      screen.getByRole("heading", { name: "Delete note?" })
    ).toBeInTheDocument()
  })

  it("points at archiving as the gentler option for a widget still on the board", () => {
    render(deleteDialog())

    expect(screen.getByText(/^This removes/)).toHaveTextContent(
      /^This removes Groceries for good\. If you might want it back, archive it instead\.$/
    )
  })

  it("drops the archive suggestion for a widget that is already archived", () => {
    render(deleteDialog({ item: { ...noteItem, archived: true } }))

    expect(screen.getByText(/^This removes/)).toHaveTextContent(
      /^This removes Groceries for good\.$/
    )
  })

  it("sets the title apart from the sentence, so a right-to-left one keeps its punctuation", () => {
    render(deleteDialog({ item: { ...noteItem, title: "مذكرات!" } }))

    // Left in the sentence, the "!" of an Arabic title lands at its left-to-right end, on the wrong side of the word.
    expect(screen.getByText("مذكرات!").tagName).toBe("BDI")
  })

  it("confirms with the widget it was handed", () => {
    const onConfirm = vi.fn()
    render(deleteDialog({ onConfirm }))

    fireEvent.click(screen.getByRole("button", { name: "Delete widget" }))

    expect(onConfirm).toHaveBeenCalledWith(noteItem)
  })

  it("cancels from the Cancel button", () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(deleteDialog({ onCancel, onConfirm }))

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("cancels when the backdrop is clicked", () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(deleteDialog({ onCancel, onConfirm }))

    // The edit dialog saves its draft on a backdrop click, but a destructive dialog has to read the same gesture as backing out.
    const backdrop = document.querySelector(".modal-backdrop") as HTMLElement
    fireEvent.pointerDown(backdrop)

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
