// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useBoardHidden } from "./useBoardHidden"
import { HIDDEN_KEY } from "~/lib/hidden"

describe("useBoardHidden", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // A new tab opened while the board is hidden must not paint the cards first, so the very first render already knows.
  it("is hidden from the first render of a tab opened while the board is hidden", () => {
    localStorage.setItem(HIDDEN_KEY, "1")
    const renders: boolean[] = []

    renderHook(() => {
      const [hidden] = useBoardHidden()
      renders.push(hidden)
    })

    expect(renders[0]).toBe(true)
  })

  it("carries a change to the next tab opened here", () => {
    const { result } = renderHook(() => useBoardHidden())
    expect(result.current[0]).toBe(false)

    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
    expect(renderHook(() => useBoardHidden()).result.current[0]).toBe(true)

    act(() => result.current[1](false))
    expect(result.current[0]).toBe(false)
    expect(renderHook(() => useBoardHidden()).result.current[0]).toBe(false)
  })

  it("follows the other board tabs on this device", () => {
    const { result } = renderHook(() => useBoardHidden())

    act(() => {
      localStorage.setItem(HIDDEN_KEY, "1")
      window.dispatchEvent(new StorageEvent("storage", { key: HIDDEN_KEY }))
    })
    expect(result.current[0]).toBe(true)

    act(() => {
      localStorage.removeItem(HIDDEN_KEY)
      window.dispatchEvent(new StorageEvent("storage", { key: HIDDEN_KEY }))
    })
    expect(result.current[0]).toBe(false)
  })
})
