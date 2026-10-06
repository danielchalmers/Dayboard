// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SettingsDialog } from "./SettingsDialog"
import { AUTO_SAVE_DELAY } from "~/hooks/useAutoSave"
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

  // The name saves the way a note does: a beat after typing stops, rather than spending a sync write on every letter.
  describe("greeting name", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    const type = (value: string) =>
      fireEvent.change(screen.getByLabelText("Your name"), { target: { value } })

    // What Options hands up for a name, with the question of whether the name is still on screen to say why it was refused.
    const savedAs = (name: string) => [{ ...DEFAULT_SETTINGS, name }, expect.any(Function)]

    it("saves the whole name once, a beat after typing stops", () => {
      vi.useFakeTimers()
      const onChange = vi.fn()
      render(settingsDialog({ onChange }))

      // Each letter lands inside the pause the one before it started, so none of them saves on its own.
      for (const value of ["S", "Sa", "Sam"]) {
        type(value)
        vi.advanceTimersByTime(AUTO_SAVE_DELAY - 1)
      }
      expect(onChange).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(...savedAs("Sam"))
    })

    it("saves on leaving the field without waiting out the pause", () => {
      const onChange = vi.fn()
      render(settingsDialog({ onChange }))

      type("Sam")
      fireEvent.blur(screen.getByLabelText("Your name"))

      expect(onChange).toHaveBeenCalledWith(...savedAs("Sam"))
      // Still in Options to say why, should storage refuse it.
      const [, isShown] = onChange.mock.calls[0]!
      expect(isShown()).toBe(true)
    })

    it("keeps the last keystrokes when Options closes inside the pause", () => {
      const onChange = vi.fn()
      const { rerender } = render(settingsDialog({ onChange }))

      type("Sam")
      rerender(settingsDialog({ onChange, isOpen: false }))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(...savedAs("Sam"))
      // Gone with Options, so a refusal is the board's to tell.
      const [, isShown] = onChange.mock.calls[0]!
      expect(isShown()).toBe(false)
    })

    it("keeps a refused name in the field, says why, and offers it again on leaving it", async () => {
      const tooOften =
        "Couldn’t save — too many changes in a row. Give it a moment, then try again."
      const onChange = vi.fn().mockResolvedValueOnce(tooOften).mockResolvedValue(null)
      const { rerender } = render(settingsDialog({ onChange }))
      const field = screen.getByLabelText<HTMLInputElement>("Your name")

      type("Sam")
      await act(async () => {
        fireEvent.blur(field)
      })

      // The board rolls back to the stored name, which is no reason to take the typed one off screen.
      rerender(settingsDialog({ onChange, settings: { ...DEFAULT_SETTINGS } }))
      expect(field).toHaveValue("Sam")
      // Options covers the board's own notice, so the reason is given beside the field.
      expect(screen.getByRole("alert")).toHaveTextContent(tooOften)

      await act(async () => {
        fireEvent.focus(field)
        fireEvent.blur(field)
      })
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(onChange).toHaveBeenLastCalledWith(...savedAs("Sam"))
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("takes a name changed in another tab while nothing is typed in it, but never over one being typed", () => {
      const { rerender } = render(settingsDialog())
      const field = screen.getByLabelText<HTMLInputElement>("Your name")

      rerender(settingsDialog({ settings: { ...DEFAULT_SETTINGS, name: "Robin" } }))
      expect(field).toHaveValue("Robin")

      // Options puts focus on the name as it opens, which is no sign of anything being typed.
      act(() => field.focus())
      rerender(settingsDialog({ settings: { ...DEFAULT_SETTINGS, name: "Robin Hood" } }))
      expect(field).toHaveValue("Robin Hood")

      type("Sam")
      rerender(settingsDialog({ settings: { ...DEFAULT_SETTINGS, name: "Robin Goodfellow" } }))
      expect(field).toHaveValue("Sam")
    })
  })

  it("lets the name take the direction of what is typed into it", () => {
    render(settingsDialog({ settings: { ...DEFAULT_SETTINGS, name: "مريم" } }))

    // Without it, a right-to-left name is typed into a box that lays it out left to right.
    expect(screen.getByLabelText("Your name")).toHaveAttribute("dir", "auto")
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
