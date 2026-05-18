import { afterEach, describe, expect, it, vi } from "vitest"

describe("background entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("opens a new tab when the toolbar icon is clicked", async () => {
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

    await import("./background")

    expect(handleClick).toBeTypeOf("function")

    handleClick?.()

    expect(create).toHaveBeenCalledWith({})
  })
})
