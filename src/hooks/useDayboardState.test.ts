import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const stubChrome = (set: () => Promise<void>) => {
  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        get: vi.fn(async (key: string) => ({ [key]: undefined })),
        set: vi.fn(set)
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() }
    }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("useDayboardState save failure handling", () => {
  it("rolls back the optimistic update and reports a save error", async () => {
    stubChrome(() => Promise.reject(new Error("QUOTA_BYTES quota exceeded")))

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())
    const widgetsBefore = result.current.state!.widgets

    await act(async () => {
      await result.current.setWidgets([])
    })

    // The write rejected, so the board is restored and a notice is shown.
    expect(result.current.state!.widgets).toEqual(widgetsBefore)
    expect(result.current.saveError).toMatch(/save/i)

    act(() => result.current.dismissSaveError())
    expect(result.current.saveError).toBeNull()

    // Unmount while chrome is still stubbed so the watch cleanup is safe.
    unmount()
  })

  it("clears any prior save error on a successful write", async () => {
    stubChrome(() => Promise.resolve())

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())

    await act(async () => {
      await result.current.setWidgets([])
    })

    expect(result.current.saveError).toBeNull()
    expect(result.current.state!.widgets).toEqual([])

    unmount()
  })
})
