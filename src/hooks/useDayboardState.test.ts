// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CACHE_KEY } from "~/lib/storage"
import type { DayboardState } from "~/lib/types"

// Chrome's own wording for the two quotas a write runs into, which is all there is to tell them apart by.
const TOO_LARGE = new Error("Resource::kQuotaBytesPerItem quota exceeded")
const TOO_OFTEN = new Error(
  "This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota."
)
const TOO_LARGE_NOTICE =
  "Couldn’t save — that’s more than browser sync can hold. Try shortening a long note or list."
const TOO_OFTEN_NOTICE =
  "Couldn’t save — too many changes in a row. Give it a moment, then try again."

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
    stubChrome({ set: () => Promise.reject(TOO_LARGE) })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())
    const widgetsBefore = result.current.state!.widgets

    let refused: string | null = null
    await act(async () => {
      refused = await result.current.setWidgets([])
    })

    // The write rejected, so the board is restored and a notice is shown.
    expect(result.current.state!.widgets).toEqual(widgetsBefore)
    expect(result.current.saveError).toBe(TOO_LARGE_NOTICE)
    // The caller hears the same reason, so a dialog can keep its draft and say why.
    expect(refused).toBe(TOO_LARGE_NOTICE)

    act(() => result.current.dismissSaveError())
    expect(result.current.saveError).toBeNull()

    // Unmount while chrome is still stubbed so the watch cleanup is safe.
    unmount()
  })

  it("keeps the notice up through further refusals and clears it once a write lands", async () => {
    // The first two writes hit the quota and the next one goes through, the way trimming a long note back under the limit plays out.
    let rejections = 2
    stubChrome({
      set: () => {
        if (rejections > 0) {
          rejections -= 1
          return Promise.reject(TOO_LARGE)
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
    expect(result.current.saveError).toBe(TOO_LARGE_NOTICE)

    // Refused again: the notice never blinks off while the retry is on its way.
    let shownWhileSaving: string | null = null
    await act(async () => {
      const saving = result.current.setWidgets([])
      shownWhileSaving = result.current.saveError
      await saving
    })
    expect(shownWhileSaving).toBe(TOO_LARGE_NOTICE)
    expect(result.current.saveError).toBe(TOO_LARGE_NOTICE)

    let refused: string | null = "unset"
    await act(async () => {
      refused = await result.current.setWidgets([])
    })

    expect(refused).toBeNull()
    expect(result.current.saveError).toBeNull()
    expect(result.current.state!.widgets).toEqual([])

    unmount()
  })
})

describe("describeSaveError", () => {
  it("tells a board too large to sync from one saved too often", async () => {
    const { describeSaveError } = await import("./useDayboardState")

    expect(describeSaveError(TOO_LARGE)).toBe(TOO_LARGE_NOTICE)
    // The whole-area quota is the same problem as the one-item quota as far as the user can tell.
    expect(describeSaveError(new Error("QUOTA_BYTES quota exceeded"))).toBe(
      TOO_LARGE_NOTICE
    )
    expect(describeSaveError(TOO_OFTEN)).toBe(TOO_OFTEN_NOTICE)
    expect(
      describeSaveError(
        new Error("This request exceeds the MAX_WRITE_OPERATIONS_PER_HOUR quota.")
      )
    ).toBe(TOO_OFTEN_NOTICE)
    // Chrome has spelled the size quota both ways, so the rate quotas are read in either spelling too.
    expect(
      describeSaveError(new Error("Resource::kMaxWriteOperationsPerMinute quota exceeded"))
    ).toBe(TOO_OFTEN_NOTICE)
    // Anything else gets no guess at a cause, since a wrong one sends the user off shortening notes for nothing.
    expect(describeSaveError(new Error("Extension context invalidated."))).toBe(
      "Couldn’t save that change. Try again in a moment."
    )
    expect(describeSaveError("sync blew up")).toBe(
      "Couldn’t save that change. Try again in a moment."
    )
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
      set: () => Promise.reject(TOO_OFTEN)
    })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())

    await act(async () => {
      await result.current.setWidgets([])
    })

    expect(result.current.state).toEqual(stored)
    expect(result.current.saveError).toBe(TOO_OFTEN_NOTICE)

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
      set: () => Promise.reject(TOO_OFTEN)
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
    expect(result.current.saveError).toBe(TOO_OFTEN_NOTICE)

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
