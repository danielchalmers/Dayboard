// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { TimeZoneField } from "./TimeZoneField"
import { getTimeZoneOptions } from "~/lib/time"

// The field is controlled, so filtering only shows once typing round-trips through the value prop the way it does in the dialog.
const Harness = ({ initial = "" }: { initial?: string }) => {
  const [value, setValue] = useState(initial)

  return <TimeZoneField onChange={setValue} value={value} />
}

// A real keystroke is a keydown followed by the input event it produces; the pair is what the field uses to tell typing from a programmatic value change.
const typeIntoField = (field: HTMLElement, value: string) => {
  fireEvent.keyDown(field, { key: value.slice(-1) })
  fireEvent.change(field, { target: { value } })
}

describe("TimeZoneField", () => {
  it("lists every zone on click, not just matches for the current value", () => {
    render(<TimeZoneField onChange={() => {}} value="Asia/Tokyo" />)

    const field = screen.getByLabelText("Time zone")
    expect(screen.queryByRole("listbox")).toBeNull()

    fireEvent.pointerDown(field)

    // The whole list opens even though the field already holds a zone: the system option leads, and zones sharing nothing with "Asia/Tokyo" are offered too.
    const options = screen.getAllByRole("option")
    expect(options.length).toBe(getTimeZoneOptions().length + 1)
    expect(options[0]).toHaveTextContent("System time zone")
    expect(
      screen.getByRole("option", { name: "Europe/Berlin" })
    ).toBeInTheDocument()
    // The current zone is the one marked selected.
    expect(screen.getByRole("option", { name: "Asia/Tokyo" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("narrows the list while typing and commits the chosen zone", () => {
    render(<Harness />)

    const field = screen.getByLabelText("Time zone")
    typeIntoField(field, "berlin")

    // Typing is kept as the value (free text is allowed) and filters the open list down to matches, which leaves out the system option too.
    expect(field).toHaveValue("berlin")
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Europe/Berlin"
    ])

    fireEvent.pointerDown(screen.getByRole("option", { name: "Europe/Berlin" }))

    expect(field).toHaveValue("Europe/Berlin")
    // Choosing puts the list away.
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("offers the system clock as a selectable option", () => {
    const onChange = vi.fn()

    render(<TimeZoneField onChange={onChange} value="Asia/Tokyo" />)

    fireEvent.pointerDown(screen.getByLabelText("Time zone"))
    fireEvent.pointerDown(screen.getByRole("option", { name: "System time zone" }))

    expect(onChange).toHaveBeenLastCalledWith("")
  })

  it("walks the list with arrows and picks with Enter, without submitting", () => {
    const onChange = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <TimeZoneField onChange={onChange} value="" />
      </form>
    )

    const field = screen.getByLabelText("Time zone")

    // ArrowDown opens on the current value (the system option, index 0), the next steps down the list.
    fireEvent.keyDown(field, { key: "ArrowDown" })
    expect(screen.getByRole("listbox")).toBeInTheDocument()
    fireEvent.keyDown(field, { key: "ArrowDown" })
    fireEvent.keyDown(field, { key: "Enter" })

    expect(onChange).toHaveBeenCalledWith(getTimeZoneOptions()[0])
    expect(screen.queryByRole("listbox")).toBeNull()
    // Enter chose from the list; it must not double as the form's submit.
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("closes on Escape without letting it reach the dialog above", () => {
    const onContainerKeyDown = vi.fn()

    render(
      <div onKeyDown={onContainerKeyDown}>
        <TimeZoneField onChange={() => {}} value="" />
      </div>
    )

    const field = screen.getByLabelText("Time zone")
    fireEvent.pointerDown(field)
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    fireEvent.keyDown(field, { key: "Escape" })

    // The list closes and the keystroke is spent: a dialog listening above must not close along with it.
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(onContainerKeyDown).not.toHaveBeenCalled()

    // With the list already away, the next Escape is the dialog's to handle.
    fireEvent.keyDown(field, { key: "Escape" })
    expect(onContainerKeyDown).toHaveBeenCalledTimes(1)
  })

  it("keeps the list closed on a programmatic value change", () => {
    // Playwright's fill and jsdom form helpers set the value without keystrokes; the list popping open would then cover the dialog's buttons mid-test and mid-import.
    render(<TimeZoneField onChange={() => {}} value="" />)

    fireEvent.change(screen.getByLabelText("Time zone"), {
      target: { value: "Europe/Paris" }
    })

    expect(screen.queryByRole("listbox")).toBeNull()
  })
})
