// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  HIDDEN_KEY,
  readBoardHidden,
  watchBoardHidden,
  writeBoardHidden
} from "./hidden"

// What another board tab's change looks like from this one.
const storageEvent = (key: string | null) =>
  window.dispatchEvent(new StorageEvent("storage", { key }))

describe("the hidden board", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("is on show until it is hidden, and again once it is shown", () => {
    expect(readBoardHidden()).toBe(false)

    writeBoardHidden(true)
    expect(readBoardHidden()).toBe(true)

    writeBoardHidden(false)
    expect(readBoardHidden()).toBe(false)
    // Shown is the absence of the mark rather than a second value, so nothing is left behind.
    expect(localStorage.getItem(HIDDEN_KEY)).toBeNull()
  })

  it("stays on show, and does not throw, when localStorage can't be used", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied")
    })

    expect(() => writeBoardHidden(true)).not.toThrow()
    expect(readBoardHidden()).toBe(false)
  })

  it("follows a board hidden or shown in another tab", () => {
    const listener = vi.fn()
    const stop = watchBoardHidden(listener)

    localStorage.setItem(HIDDEN_KEY, "1")
    storageEvent(HIDDEN_KEY)
    expect(listener).toHaveBeenLastCalledWith(true)

    // Clearing localStorage reports no key, and takes the mark with it.
    localStorage.clear()
    storageEvent(null)
    expect(listener).toHaveBeenLastCalledWith(false)

    // The board's own mirror changes with every edit, and says nothing about this.
    storageEvent("dayboard-state-cache")
    expect(listener).toHaveBeenCalledTimes(2)

    stop()
    storageEvent(HIDDEN_KEY)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
