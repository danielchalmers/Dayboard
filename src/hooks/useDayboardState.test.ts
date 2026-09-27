// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CACHE_KEY } from "~/lib/storage"
import type { DayboardState } from "~/lib/types"

const SAVE_ERROR = "Couldn’t save — this board may be too large to sync."

const stubChrome = ({
  get = async (key: string) => ({ [key]: undefined }),
  set = () => Promise.resolve()
}: {
  get?: (key: string) => Promise<Record<string, unknown>>
  set?: () => Promise<void>
} = {}) => {
  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        get: vi.fn(get),
        set: vi.fn(set)
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() }
    }
  })
}

// Reads mirror themselves into localStorage, so without this a board cached by one test hydrates the next one's first render.
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  localStorage.clear()
})

describe("useDayboardState save failure handling", () => {
  it("rolls back the optimistic update and reports a save error", async () => {
    stubChrome({
      set: () => Promise.reject(new Error("QUOTA_BYTES quota exceeded"))
    })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())
    const widgetsBefore = result.current.state!.widgets

    await act(async () => {
      await result.current.setWidgets([])
    })

    // The write rejected, so the board is restored and a notice is shown.
    expect(result.current.state!.widgets).toEqual(widgetsBefore)
    expect(result.current.saveError).toBe(SAVE_ERROR)

    act(() => result.current.dismissSaveError())
    expect(result.current.saveError).toBeNull()

    // Unmount while chrome is still stubbed so the watch cleanup is safe.
    unmount()
  })

  it("clears any prior save error on a successful write", async () => {
    // The first write hits the quota and the next one goes through.
    let rejectNext = true
    stubChrome({
      set: () => {
        if (rejectNext) {
          rejectNext = false
          return Promise.reject(new Error("QUOTA_BYTES quota exceeded"))
        }

        return Promise.resolve()
      }
    })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())

    await act(async () => {
      await result.current.setWidgets([])
    })
    expect(result.current.saveError).toBe(SAVE_ERROR)

    await act(async () => {
      await result.current.setWidgets([])
    })

    expect(result.current.saveError).toBeNull()
    expect(result.current.state!.widgets).toEqual([])

    unmount()
  })
})

describe("useDayboardState change handling", () => {
  const board: DayboardState = {
    widgets: [
      { id: "t1", kind: "timer", title: "Tea", colorPreset: "teal", settings: { durationMs: 1000, running: true, remainingMs: 1000, endsAt: 1, chime: false } },
      { id: "t2", kind: "timer", title: "Eggs", colorPreset: "amber", settings: { durationMs: 1000, running: true, remainingMs: 1000, endsAt: 1, chime: false } }
    ],
    settings: { name: "" }
  }

  it("keeps both of two changes made in the same tick", async () => {
    stubChrome({ get: async (key) => ({ [key]: board }) })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())

    // Two timers finishing on the same tick report from the same commit, before the board has re-rendered in between.
    await act(async () => {
      const [first, second] = result.current.state!.widgets as typeof board.widgets
      void result.current.updateWidget({ ...first!, title: "Tea done" })
      void result.current.updateWidget({ ...second!, title: "Eggs done" })
    })

    expect(result.current.state!.widgets.map((widget) => widget.title)).toEqual([
      "Tea done",
      "Eggs done"
    ])
    const written = vi.mocked(chrome.storage.sync.set).mock.calls.at(-1)?.[0] as
      Record<string, DayboardState>
    expect(Object.values(written)[0]!.widgets.map((widget) => widget.title)).toEqual([
      "Tea done",
      "Eggs done"
    ])

    unmount()
  })

  it("does not write when the changed widget is no longer on the board", async () => {
    stubChrome({ get: async (key) => ({ [key]: board }) })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())

    await act(async () => {
      await result.current.updateWidget({ ...board.widgets[0]!, id: "gone" })
    })

    expect(chrome.storage.sync.set).not.toHaveBeenCalled()

    unmount()
  })

  it("leaves the board untouched when storage echoes back what is already shown", async () => {
    stubChrome({ get: async (key) => ({ [key]: board }) })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())
    const shown = result.current.state

    const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0]![0]
    act(() => {
      listener(
        { "dayboard-state": { newValue: JSON.parse(JSON.stringify(board)) } },
        "sync"
      )
    })

    expect(result.current.state).toBe(shown)

    unmount()
  })

  it("puts a failed write back to what storage holds", async () => {
    const stored = { ...board, settings: { name: "Sam" } }
    stubChrome({
      get: async (key) => ({ [key]: stored }),
      set: () => Promise.reject(new Error("MAX_WRITE_OPERATIONS_PER_MINUTE"))
    })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())

    await act(async () => {
      await result.current.setWidgets([])
    })

    expect(result.current.state).toEqual(stored)
    expect(result.current.saveError).toBe(SAVE_ERROR)

    unmount()
  })

  it("falls back to the board from before the change when storage can't be read back either", async () => {
    // The first read loads the board; by the time the write fails, sync has gone away altogether.
    let reads = 0
    stubChrome({
      get: async (key) => {
        reads += 1

        if (reads > 1) {
          throw new Error("Sync is unavailable")
        }

        return { [key]: board }
      },
      set: () => Promise.reject(new Error("MAX_WRITE_OPERATIONS_PER_MINUTE"))
    })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())
    const shown = result.current.state

    await act(async () => {
      await result.current.setWidgets([])
    })

    // The change never persisted and nothing better can be learned, so the board goes back to what it was rather than keeping an edit storage doesn't hold.
    expect(reads).toBe(2)
    expect(result.current.state).toEqual(shown)
    expect(result.current.saveError).toBe(SAVE_ERROR)

    unmount()
  })

  it("saves new settings alongside the board as it stands", async () => {
    stubChrome({ get: async (key) => ({ [key]: board }) })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())

    await act(async () => {
      await result.current.setSettings({ name: "Sam" })
    })

    const expected = { widgets: board.widgets, settings: { name: "Sam" } }
    expect(result.current.state).toEqual(expected)
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      "dayboard-state": expected
    })

    unmount()
  })
})

describe("useDayboardState load failure handling", () => {
  const cachedBoard: DayboardState = {
    widgets: [
      {
        id: "clock-1",
        kind: "clock",
        title: "Tokyo",
        colorPreset: "teal",
        settings: { timeZone: "Asia/Tokyo" }
      }
    ],
    settings: { name: "" }
  }

  it("reports a failed read when there is no cached board to show instead", async () => {
    stubChrome({ get: () => Promise.reject(new Error("Sync is unavailable")) })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.state).toBeNull()
    // What the read actually said is more use than the generic fallback, so it is carried through verbatim.
    expect(result.current.error).toBe("Sync is unavailable")

    unmount()
  })

  it("still has something to say when the read rejects with a non-Error", async () => {
    stubChrome({ get: () => Promise.reject("sync blew up") })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.error).toBe("Unable to load data"))

    unmount()
  })

  it("keeps a cached board on screen when the read fails", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cachedBoard))
    stubChrome({ get: () => Promise.reject(new Error("Sync is unavailable")) })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    // The localStorage mirror fills the first render, so the board never passes through a loading state.
    expect(result.current.isLoading).toBe(false)
    expect(result.current.state).toEqual(cachedBoard)

    // A timeout lands after every microtask the rejected read queues, so this is the earliest point an error could have been set.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // A transient sync failure with a board already on screen is not worth replacing that board with an error page.
    expect(result.current.error).toBeNull()
    expect(result.current.state).toEqual(cachedBoard)

    unmount()
  })
})
