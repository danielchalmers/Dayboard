import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SettingsDialog } from "./SettingsDialog"
import { DEFAULT_SETTINGS } from "~/lib/types"

describe("SettingsDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <SettingsDialog
        isOpen={false}
        settings={DEFAULT_SETTINGS}
        onChange={() => {}}
        onClose={() => {}}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("toggles drag-to-move through the switch", () => {
    const onChange = vi.fn()
    render(
      <SettingsDialog
        isOpen
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={() => {}}
      />
    )

    fireEvent.click(screen.getByRole("switch", { name: "Drag to rearrange" }))

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, dragToMove: false })
  })

  it("changes the column count through the select", () => {
    const onChange = vi.fn()
    render(
      <SettingsDialog
        isOpen
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={() => {}}
      />
    )

    fireEvent.change(screen.getByLabelText("Columns"), { target: { value: "2" } })

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, columns: 2 })
  })

  it("returns to the auto column setting", () => {
    const onChange = vi.fn()
    render(
      <SettingsDialog
        isOpen
        settings={{ dragToMove: true, columns: 3, name: "", chimeOnTimerEnd: false }}
        onChange={onChange}
        onClose={() => {}}
      />
    )

    fireEvent.change(screen.getByLabelText("Columns"), { target: { value: "auto" } })

    expect(onChange).toHaveBeenCalledWith({
      dragToMove: true,
      columns: "auto",
      name: "",
      chimeOnTimerEnd: false
    })
  })

  it("toggles the timer chime", () => {
    const onChange = vi.fn()
    render(
      <SettingsDialog
        isOpen
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={() => {}}
      />
    )

    fireEvent.click(screen.getByRole("switch", { name: "Timer chime" }))

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      chimeOnTimerEnd: true
    })
  })

  it("edits the greeting name", () => {
    const onChange = vi.fn()
    render(
      <SettingsDialog
        isOpen
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={() => {}}
      />
    )

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Sam" }
    })

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, name: "Sam" })
  })

  it("closes from the Done button", () => {
    const onClose = vi.fn()
    render(
      <SettingsDialog
        isOpen
        settings={DEFAULT_SETTINGS}
        onChange={() => {}}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Done" }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
