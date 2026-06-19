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

  it("exports from the Export button and imports a chosen file", () => {
    const onExport = vi.fn()
    const onImport = vi.fn()
    render(
      <SettingsDialog
        isOpen
        settings={DEFAULT_SETTINGS}
        onChange={() => {}}
        onClose={() => {}}
        onExport={onExport}
        onImport={onImport}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    expect(onExport).toHaveBeenCalledTimes(1)

    const file = new File(["{}"], "board.json", { type: "application/json" })
    fireEvent.change(screen.getByLabelText("Import board file"), {
      target: { files: [file] }
    })
    expect(onImport).toHaveBeenCalledWith(file)
  })

  it("shows an import error when one is provided", () => {
    render(
      <SettingsDialog
        isOpen
        settings={DEFAULT_SETTINGS}
        onChange={() => {}}
        onClose={() => {}}
        importError="That file is not a Clockboard board."
      />
    )

    expect(
      screen.getByText("That file is not a Clockboard board.")
    ).toBeInTheDocument()
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
