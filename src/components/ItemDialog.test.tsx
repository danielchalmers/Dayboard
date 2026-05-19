import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ItemDialog } from "./ItemDialog"
import type { Widget } from "~/lib/types"

const clockWidget: Widget = {
  id: "local",
  kind: "clock",
  title: "Local time",
  color: null,
  placement: "main",
  settings: {
    timeZone: "UTC"
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
}

describe("ItemDialog", () => {
  it("saves the selected widget color", () => {
    const onSave = vi.fn()

    render(
      <ItemDialog
        isOpen
        item={clockWidget}
        mode="edit"
        onClose={() => {}}
        onSave={onSave}
      />
    )

    fireEvent.click(screen.getByLabelText("Mint"))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "#26a69a"
      })
    )
  })
})
