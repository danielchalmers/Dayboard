// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useNow } from "./useNow"

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 4, 10, 17, 42, 900))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("re-renders only when its own floored value moves", () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useNow("minute")
    })
    const first = result.current
    expect(first.getTime()).toBe(new Date(2026, 2, 4, 10, 17).getTime())
    renders = 0

    // A second-level neighbour ticking the store does not render a minute subscriber.
    act(() => {
      vi.advanceTimersByTime(17_000)
    })
    expect(renders).toBe(0)
    expect(result.current).toBe(first)

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(renders).toBe(1)
    expect(result.current.getTime()).toBe(new Date(2026, 2, 4, 10, 18).getTime())
  })

  it("follows a change of granularity without a stale minute", () => {
    const { result, rerender } = renderHook(
      ({ granularity }: { granularity: "second" | "minute" }) => useNow(granularity),
      { initialProps: { granularity: "minute" as "second" | "minute" } }
    )
    expect(result.current.getTime()).toBe(new Date(2026, 2, 4, 10, 17).getTime())

    rerender({ granularity: "second" })
    expect(result.current.getTime()).toBe(new Date(2026, 2, 4, 10, 17, 42).getTime())

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.getTime()).toBe(new Date(2026, 2, 4, 10, 17, 43).getTime())
  })
})
