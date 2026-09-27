// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { SettingsDialog } from "./SettingsDialog"
import { DEFAULT_SETTINGS } from "~/lib/types"

// An open dialog on default settings with inert callbacks, so each test names only the props it actually cares about.
const settingsDialog = (
  props: Partial<ComponentProps<typeof SettingsDialog>> = {}
) => (
  <SettingsDialog
    isOpen
    settings={DEFAULT_SETTINGS}
    onChange={() => {}}
    onClose={() => {}}
    {...props}
  />
)

describe("SettingsDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(settingsDialog({ isOpen: false }))

    expect(container).toBeEmptyDOMElement()
  })

  it("edits the greeting name", () => {
    const onChange = vi.fn()
    render(settingsDialog({ onChange }))

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Sam" }
    })

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, name: "Sam" })
  })

  // The file input itself is hidden, so the Import button is the only way anyone reaches the picker.
  it("opens the file picker from the Import button", () => {
    render(settingsDialog())

    const input = screen.getByLabelText<HTMLInputElement>("Import board file")
    const pick = vi.spyOn(input, "click").mockImplementation(() => {})

    fireEvent.click(screen.getByRole("button", { name: "Import" }))

    expect(pick).toHaveBeenCalledTimes(1)
  })

  it("exports from the Export button and imports a chosen file", () => {
    const onExport = vi.fn()
    const onImport = vi.fn()
    render(settingsDialog({ onExport, onImport }))

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    expect(onExport).toHaveBeenCalledTimes(1)

    const file = new File(["{}"], "board.json", { type: "application/json" })
    fireEvent.change(screen.getByLabelText("Import board file"), {
      target: { files: [file] }
    })
    expect(onImport).toHaveBeenCalledWith(file)
  })

  it("announces an import error when one is provided", () => {
    const { rerender } = render(settingsDialog())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    rerender(settingsDialog({ importError: "That file is not a Dayboard board." }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That file is not a Dayboard board."
    )
  })

  it("links to the project on GitHub", () => {
    render(settingsDialog())

    expect(
      screen.getByRole("link", { name: /Dayboard on GitHub/ })
    ).toHaveAttribute("href", "https://github.com/danielchalmers/Dayboard")
  })

  it("offers a feedback link to the GitHub issues page", () => {
    render(settingsDialog())

    expect(
      screen.getByRole("link", { name: /Give feedback/ })
    ).toHaveAttribute("href", "https://github.com/danielchalmers/Dayboard/issues")
  })

  it("closes from the Done button", () => {
    const onClose = vi.fn()
    render(settingsDialog({ onClose }))

    fireEvent.click(screen.getByRole("button", { name: "Done" }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
