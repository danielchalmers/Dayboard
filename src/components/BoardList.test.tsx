import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { BoardList } from "./BoardList"
import type { Widget } from "~/lib/types"

const widgets: Widget[] = [
  {
    id: "local",
    kind: "clock",
    title: "Local time",
    colorPreset: "slate",
    settings: {
      timeZone: "UTC"
    }
  },
  {
    id: "launch",
    kind: "countdown",
    title: "Launch",
    colorPreset: "rose",
    settings: {
      targetAt: "2026-01-02T09:00:00.000Z"
    }
  }
]

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      addEventListener: () => {},
      matches: false,
      removeEventListener: () => {}
    })
  })
})

describe("BoardList", () => {
  it("makes each widget card draggable", () => {
    const { container } = render(<BoardList items={widgets} now={new Date("2026-01-01T12:30:00.000Z")} />)

    expect(container.querySelectorAll(".board-row--draggable")).toHaveLength(2)
  })

  it("opens the widget menu on right click without rendering a dedicated button", () => {
    const { container } = render(
      <BoardList
        items={widgets}
        now={new Date("2026-01-01T12:30:00.000Z")}
        renderItemActions={(item) => (
          <button aria-label={`Edit ${item.title}`} type="button">
            Edit
          </button>
        )}
      />
    )

    expect(screen.queryByLabelText("Actions for Local time")).not.toBeInTheDocument()
    expect(container.querySelector(".card-menu__panel")).not.toBeInTheDocument()

    fireEvent.contextMenu(container.querySelector(".board-row--draggable") as Element)

    expect(screen.getByLabelText("Actions for Local time")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reorder Local time" })).not.toBeInTheDocument()
    expect(container.querySelector('[aria-label="Edit Local time"]')).toBeInTheDocument()
  })
})
