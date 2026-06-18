import { afterEach, describe, expect, it, vi } from "vitest"

import { registerBackground } from "./background"

describe("registerBackground", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("opens a new tab when the toolbar icon is clicked", () => {
    let handleClick: (() => void) | undefined
    const create = vi.fn()

    vi.stubGlobal("chrome", {
      action: {
        onClicked: {
          addListener: vi.fn((listener: () => void) => {
            handleClick = listener
          })
        }
      },
      tabs: {
        create
      }
    })

    registerBackground()

    expect(handleClick).toBeTypeOf("function")

    handleClick?.()

    expect(create).toHaveBeenCalledWith({})
  })
})
