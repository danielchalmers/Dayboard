// @vitest-environment jsdom

import { act, render as renderComponent, renderHook, waitFor } from "@testing-library/react"
import { createElement, useEffect } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CACHE_KEY } from "~/lib/storage"
import type {
  DayboardState,
  HabitWidget,
  NoteWidget,
  TimerWidget
} from "~/lib/types"

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
  set?: (items: Record<string, DayboardState>) => Promise<void>
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

    // Two timers finishing on the same tick settle from the same commit, before the board has re-rendered in between.
    await act(async () => {
      for (const timer of result.current.state!.widgets as TimerWidget[]) {
        void result.current.settleTimer(timer.id, timer.settings.endsAt!)
      }
    })

    const finished = (widgets: DayboardState["widgets"]) =>
      widgets.map((widget) => widget.kind === "timer" && widget.settings.remainingMs === 0)

    expect(finished(result.current.state!.widgets)).toEqual([true, true])
    const written = vi.mocked(chrome.storage.sync.set).mock.calls.at(-1)?.[0] as
      Record<string, DayboardState>
    expect(finished(Object.values(written)[0]!.widgets)).toEqual([true, true])

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

  it("settles a timer's run from the card as it stands, once", async () => {
    stubChrome({ get: async (key) => ({ [key]: board }) })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())

    // The chime was switched on in the run's own dialog after its timeout was set, which leaves the run going.
    const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0]![0]
    const chimed = {
      ...board,
      widgets: board.widgets.map((widget) =>
        widget.id === "t1" && widget.kind === "timer"
          ? { ...widget, settings: { ...widget.settings, chime: true } }
          : widget
      )
    }
    act(() => {
      listener({ "dayboard-state": { newValue: chimed } }, "sync")
    })

    let settled: (TimerWidget | null)[] = []
    await act(async () => {
      settled = await Promise.all([
        result.current.settleTimer("t1", 1),
        result.current.settleTimer("t1", 1)
      ])
    })

    // The second report of the same finish finds nothing left to settle.
    expect(settled[1]).toBeNull()
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1)
    // The card hears the timer as the board now holds it, so the chime it announces with is the one switched on since.
    expect(settled[0]).toBe(result.current.state!.widgets[0])
    expect(result.current.state!.widgets[0]!.settings).toEqual({
      durationMs: 1000,
      running: false,
      remainingMs: 0,
      endsAt: null,
      chime: true
    })

    unmount()
  })

  // A board can hear of a newer board from storage before it has rendered it, so the card asks about the run it last saw.
  it("leaves a run started since alone when an older finish is reported", async () => {
    stubChrome({ get: async (key) => ({ [key]: board }) })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    await waitFor(() => expect(result.current.state).not.toBeNull())

    const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0]![0]
    const restarted = {
      ...board,
      widgets: board.widgets.map((widget) =>
        widget.id === "t1" && widget.kind === "timer"
          ? { ...widget, settings: { ...widget.settings, endsAt: 9000 } }
          : widget
      )
    }

    let settling: Promise<TimerWidget | null> = Promise.resolve(null)
    act(() => {
      listener({ "dayboard-state": { newValue: restarted } }, "sync")
      settling = result.current.settleTimer("t1", 1)
    })

    expect(await settling).toBeNull()
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
    expect(result.current.state!.widgets[0]!.settings).toMatchObject({
      running: true,
      endsAt: 9000
    })

    unmount()
  })

  // A new tab paints from its localStorage mirror, which stood still while no board was open here.
  // Since then another device settled Tea and changed the greeting name, and Eggs is still going in storage too.
  it("waits for storage's own board before settling a finish the mirror shows", async () => {
    const stored: DayboardState = {
      widgets: board.widgets.map((widget) =>
        widget.id === "t1" && widget.kind === "timer"
          ? {
              ...widget,
              settings: { ...widget.settings, running: false, remainingMs: 0, endsAt: null }
            }
          : widget
      ),
      settings: { name: "Sam" }
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(board))
    let answerRead = () => {}
    stubChrome({
      get: (key) =>
        new Promise((resolve) => {
          answerRead = () => resolve({ [key]: stored })
        })
    })

    const { useDayboardState } = await import("./useDayboardState")
    const { result, unmount } = renderHook(() => useDayboardState())

    // Both timers are going on the mirror, but writing it back would undo the other device's changes, so their finishes wait for storage's answer.
    expect(result.current.state!.widgets[0]!.settings).toMatchObject({ running: true })
    let settling: Promise<(TimerWidget | null)[]> = Promise.resolve([])
    await act(async () => {
      settling = Promise.all([
        result.current.settleTimer("t1", 1),
        result.current.settleTimer("t2", 1)
      ])
    })
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()

    let settled: (TimerWidget | null)[] = []
    await act(async () => {
      answerRead()
      settled = await settling
    })

    // Tea was settled on the other device, so only Eggs is, and on the board as storage has it.
    expect(settled[0]).toBeNull()
    expect(settled[1]?.title).toBe("Eggs")
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1)
    const written = vi.mocked(chrome.storage.sync.set).mock.calls[0]![0] as
      Record<string, DayboardState>
    const saved = Object.values(written)[0]!
    expect(saved.settings).toEqual({ name: "Sam" })
    expect(saved.widgets.map((widget) => widget.settings)).toMatchObject([
      { running: false, remainingMs: 0 },
      { running: false, remainingMs: 0 }
    ])

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

// A running timer and a note, for the tabs below that come to a board older than storage's.
const tea = (endsAt: number): TimerWidget => ({
  id: "tea",
  kind: "timer",
  title: "Tea",
  colorPreset: "rose",
  settings: { durationMs: 6000, running: true, remainingMs: 6000, endsAt, chime: false }
})
const groceries = (text: string): NoteWidget => ({
  id: "groceries",
  kind: "note",
  title: "Groceries",
  colorPreset: "sky",
  settings: { text }
})

// A timer as its finish leaves it.
const finished = (timer: TimerWidget): TimerWidget => ({
  ...timer,
  settings: { ...timer.settings, running: false, remainingMs: 0, endsAt: null }
})

// Chrome delivers the storage changes a frozen tab missed only after its own wake-up work, and the clock catching up as it comes back into view is part of that.
describe("useDayboardState in a tab waking from being frozen", () => {
  // The board as the tab froze with it, the timer's run since over.
  const frozenWith: DayboardState = {
    widgets: [tea(1_000), groceries("Milk")],
    settings: { name: "" }
  }

  // Storage answers the first read with the board the tab froze with, and the read it starts on waking only when the test says, the way that answer queues behind the changes delivered on waking.
  const render = async () => {
    let answerWake: (state: DayboardState) => void = () => {}
    let reads = 0
    stubChrome({
      get: (key) => {
        reads += 1

        return reads === 1
          ? Promise.resolve({ [key]: structuredClone(frozenWith) })
          : new Promise((resolve) => {
              answerWake = (state) => resolve({ [key]: structuredClone(state) })
            })
      }
    })

    const { useDayboardState } = await import("./useDayboardState")
    const hook = renderHook(() => useDayboardState())

    await waitFor(() => expect(hook.result.current.state).not.toBeNull())

    const deliver = (state: DayboardState) => {
      const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0]![0]
      act(() => {
        listener({ "dayboard-state": { newValue: structuredClone(state) } }, "sync")
      })
    }

    return { ...hook, answerWake: (state: DayboardState) => answerWake(state), deliver }
  }

  it("drops a change worked out from a card another tab has changed since", async () => {
    const { result, unmount, answerWake, deliver } = await render()

    act(() => {
      document.dispatchEvent(new Event("resume"))
    })

    // Back in view, a word is added to the note as the tab froze with it, before the tab has heard that another tab added to it too.
    let saving: Promise<string | null> = Promise.resolve(null)
    act(() => {
      saving = result.current.updateWidget(groceries("Milk, tea"))
    })

    const meanwhile: DayboardState = {
      widgets: [tea(1_000), groceries("Milk, eggs, bread")],
      settings: { name: "" }
    }
    deliver(meanwhile)

    let refused: string | null = "unset"
    await act(async () => {
      answerWake(meanwhile)
      refused = await saving
    })

    expect(refused).toBeNull()
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
    expect(result.current.state).toEqual(meanwhile)

    unmount()
  })

  it("holds a change until the tab has caught up, then lays it on the board as it is now", async () => {
    const { result, unmount, answerWake, deliver } = await render()

    act(() => {
      document.dispatchEvent(new Event("resume"))
    })

    // Another tab started the timer again while this one slept, but nobody else touched the note.
    let saving: Promise<string | null> = Promise.resolve(null)
    act(() => {
      saving = result.current.updateWidget(groceries("Milk, tea"))
    })

    const meanwhile: DayboardState = {
      widgets: [tea(99_000), groceries("Milk")],
      settings: { name: "" }
    }
    deliver(meanwhile)

    // The board has heard the timer changed, but not yet that there is nothing more to hear.
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()

    await act(async () => {
      answerWake(meanwhile)
      await saving
    })

    const expected = {
      widgets: [tea(99_000), groceries("Milk, tea")],
      settings: { name: "" }
    }
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1)
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ "dayboard-state": expected })
    expect(result.current.state).toEqual(expected)

    unmount()
  })

  // The timer's own timeout, long overdue, runs as the tab wakes, before the tab has heard that another tab finished the run and started a new one.
  it("answers a finish the tab froze with only once it has caught up, and then with no", async () => {
    const { result, unmount, answerWake, deliver } = await render()

    act(() => {
      document.dispatchEvent(new Event("resume"))
    })

    let settling: Promise<TimerWidget | null> = Promise.resolve(null)
    act(() => {
      settling = result.current.settleTimer("tea", 1_000)
    })

    const meanwhile: DayboardState = {
      widgets: [tea(99_000), groceries("Milk, eggs, bread")],
      settings: { name: "" }
    }
    deliver(meanwhile)

    let settled: TimerWidget | null | undefined
    await act(async () => {
      answerWake(meanwhile)
      settled = await settling
    })

    // So the card has no finish to chime or set the title for, and the board stays as the other tab left it.
    expect(settled).toBeNull()
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
    expect(result.current.state).toEqual(meanwhile)

    unmount()
  })
})

// The localStorage mirror only moves while a board tab is open, so a new tab paints whatever the last one left there, however long ago that was.
describe("useDayboardState in a new tab painted from the mirror", () => {
  // The board as the last tab here left it, its timer run since over.
  const remembered: DayboardState = {
    widgets: [tea(1_000), groceries("Milk")],
    settings: { name: "" }
  }

  // Meanwhile, on another device, the timer was reset and the note added to.
  const movedOn: DayboardState = {
    widgets: [
      { ...tea(1_000), settings: { ...tea(1_000).settings, running: false, endsAt: null } },
      groceries("Milk, eggs, bread")
    ],
    settings: { name: "" }
  }

  // A board whose timer card reports its run's end from its own effect as it mounts, the way the real card does, which is before the hook's effects have run and so before its first read has even started.
  const render = async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(remembered))

    let answerFirstRead: (state: DayboardState) => void = () => {}
    stubChrome({
      get: (key) =>
        new Promise((resolve) => {
          answerFirstRead = (state) => resolve({ [key]: structuredClone(state) })
        })
    })

    const { useDayboardState } = await import("./useDayboardState")
    const board: { current: ReturnType<typeof useDayboardState> | null } = { current: null }
    const settled: Promise<TimerWidget | null>[] = []

    const Settles = ({ timer, settleTimer }: { timer: TimerWidget; settleTimer: (id: string, endsAt: number) => Promise<TimerWidget | null> }) => {
      useEffect(() => {
        settled.push(settleTimer(timer.id, timer.settings.endsAt!))
      }, [settleTimer, timer])

      return null
    }

    const Board = () => {
      board.current = useDayboardState()
      const timer = board.current.state?.widgets.find(
        (widget): widget is TimerWidget => widget.kind === "timer" && widget.settings.running
      )

      return timer ? createElement(Settles, { timer, settleTimer: board.current.settleTimer }) : null
    }

    const view = renderComponent(createElement(Board))

    // The board painted from the mirror, and its timer reported the end of its run as it did.
    expect(board.current!.state).toEqual(remembered)
    expect(settled).toHaveLength(1)

    return { ...view, board, settled, answerFirstRead: (state: DayboardState) => answerFirstRead(state) }
  }

  it("answers a finish storage has moved on from with no, and writes nothing", async () => {
    const { board, settled, answerFirstRead, unmount } = await render()

    let answers: (TimerWidget | null)[] = []
    await act(async () => {
      answerFirstRead(movedOn)
      answers = await Promise.all(settled)
    })

    expect(answers).toEqual([null])
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
    expect(board.current!.state).toEqual(movedOn)

    unmount()
  })

  it("settles a run that ended while no tab was open once the first read finds it untouched", async () => {
    const { board, settled, answerFirstRead, unmount } = await render()

    // Only the note changed elsewhere, so the run really is over.
    const stored: DayboardState = {
      widgets: [tea(1_000), groceries("Milk, eggs, bread")],
      settings: { name: "" }
    }

    let answers: (TimerWidget | null)[] = []
    await act(async () => {
      answerFirstRead(stored)
      answers = await Promise.all(settled)
    })

    const expected = {
      widgets: [finished(tea(1_000)), groceries("Milk, eggs, bread")],
      settings: { name: "" }
    }
    expect(answers).toEqual([finished(tea(1_000))])
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1)
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ "dayboard-state": expected })
    expect(board.current!.state).toEqual(expected)

    unmount()
  })

  // A word added to the note in the moment the board shows the mirror, before the first read has landed.
  it("drops a change worked out from a card storage has moved on from", async () => {
    const { board, settled, answerFirstRead, unmount } = await render()

    let saving: Promise<string | null> = Promise.resolve(null)
    act(() => {
      saving = board.current!.updateWidget(groceries("Milk, tea"))
    })
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()

    let refused: string | null = "unset"
    await act(async () => {
      answerFirstRead(movedOn)
      await Promise.all(settled)
      refused = await saving
    })

    expect(refused).toBeNull()
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
    expect(board.current!.state).toEqual(movedOn)

    unmount()
  })
})

// A note keeps words storage refused on screen (see useAutoSave), where every other card shows what the board rolled back to.
describe("useDayboardState with a note holding refused words", () => {
  const note: NoteWidget = {
    id: "jot",
    kind: "note",
    title: "Jot",
    colorPreset: "slate",
    settings: { text: "Short" }
  }
  const habit: HabitWidget = {
    id: "walk",
    kind: "habit",
    title: "Walk",
    colorPreset: "amber",
    settings: { history: [] }
  }
  const long = "Short, and a long paste after it"

  // A store that holds what is written to it and refuses whatever `refuses` says it can't take, the way sync refuses a note grown past its item quota.
  const stubStore = (refuses: (state: DayboardState) => Error | null) => {
    let stored: DayboardState = { widgets: [note, habit], settings: { name: "" } }

    stubChrome({
      get: async (key) => ({ [key]: structuredClone(stored) }),
      set: async (items) => {
        const next = Object.values(items)[0]!
        const refusal = refuses(next)

        if (refusal) {
          throw refusal
        }

        stored = structuredClone(next)
      }
    })

    return { stored: () => stored }
  }

  const noteIn = (state: DayboardState) =>
    state.widgets.find((widget) => widget.id === note.id) as NoteWidget | undefined

  const tooLong = (state: DayboardState) =>
    (noteIn(state)?.settings.text.length ?? 0) > note.settings.text.length + 10 ? TOO_LARGE : null

  const withText = (text: string): NoteWidget => ({ ...note, settings: { text } })

  const render = async () => {
    const { useDayboardState } = await import("./useDayboardState")
    const hook = renderHook(() => useDayboardState())

    await waitFor(() => expect(hook.result.current.state).not.toBeNull())

    return hook
  }

  it("keeps the notice up through other saves until the note's own words land", async () => {
    stubStore(tooLong)
    const { result, unmount } = await render()

    await act(async () => {
      await result.current.updateWidget(withText(long))
    })
    expect(result.current.saveError).toBe(TOO_LARGE_NOTICE)

    // Marking a habit saves fine, but says nothing about the note, which still shows words storage doesn't hold.
    await act(async () => {
      await result.current.updateWidget({ ...habit, settings: { history: ["2026-10-05"] } })
    })
    expect(result.current.saveError).toBe(TOO_LARGE_NOTICE)

    await act(async () => {
      await result.current.updateWidget(withText("Short, trimmed"))
    })
    expect(result.current.saveError).toBeNull()

    unmount()
  })

  it("lets the notice go at the next save after a card that shows what rolled back", async () => {
    stubStore((state) =>
      state.widgets.some((widget) => widget.kind === "habit" && widget.settings.history.length > 0)
        ? TOO_OFTEN
        : null
    )
    const { result, unmount } = await render()

    await act(async () => {
      await result.current.updateWidget({ ...habit, settings: { history: ["2026-10-05"] } })
    })
    expect(result.current.saveError).toBe(TOO_OFTEN_NOTICE)

    await act(async () => {
      await result.current.updateWidget(withText("Short, more"))
    })
    expect(result.current.saveError).toBeNull()

    unmount()
  })

  it("lets the notice go once the words are typed back to what is stored, without a write", async () => {
    stubStore(tooLong)
    const { result, unmount } = await render()

    await act(async () => {
      await result.current.updateWidget(withText(long))
    })
    const writes = vi.mocked(chrome.storage.sync.set).mock.calls.length

    await act(async () => {
      await result.current.updateWidget(withText(note.settings.text))
    })

    expect(result.current.saveError).toBeNull()
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(writes)

    unmount()
  })

  it("lets the notice go once the note is deleted", async () => {
    stubStore(tooLong)
    const { result, unmount } = await render()

    await act(async () => {
      await result.current.updateWidget(withText(long))
    })
    await act(async () => {
      await result.current.setWidgets([habit])
    })
    // The deleted note is still holding its words until its card unmounts.
    expect(result.current.saveError).toBe(TOO_LARGE_NOTICE)

    // Unmounting, the card offers them one last time, and with the note gone there is nothing left to save them to.
    await act(async () => {
      await result.current.updateWidget(withText(long))
    })
    expect(result.current.saveError).toBeNull()

    unmount()
  })

  it("keeps a note archived when it offers refused words again as it unmounts", async () => {
    // Refused once for writing too often, then let through, as a burst of saves plays out.
    let refusals = 1
    const { stored } = stubStore(() => (refusals-- > 0 ? TOO_OFTEN : null))
    const { result, unmount } = await render()

    await act(async () => {
      await result.current.updateWidget(withText(long))
    })
    await act(async () => {
      await result.current.setWidgets([{ ...note, archived: true }, habit])
    })

    // The card unmounts from the board and flushes from the copy it last rendered, which was never archived.
    await act(async () => {
      await result.current.updateWidget(withText(long))
    })

    expect(noteIn(stored())).toEqual({ ...note, archived: true, settings: { text: long } })
    expect(noteIn(result.current.state!)?.archived).toBe(true)
    expect(result.current.saveError).toBeNull()

    unmount()
  })
})

// The greeting name keeps refused words in its field the way a note does, but Options covers the board and its notice, so it says why there instead (see SettingsDialog).
describe("useDayboardState saving the greeting name", () => {
  const habit: HabitWidget = {
    id: "walk",
    kind: "habit",
    title: "Walk",
    colorPreset: "amber",
    settings: { history: [] }
  }

  // Refuses every write that would change the name while `refusing` says so, the way a burst of writes plays out.
  const render = async () => {
    const control = { refusing: true }
    let stored: DayboardState = { widgets: [habit], settings: { name: "Sam" } }

    stubChrome({
      get: async (key) => ({ [key]: structuredClone(stored) }),
      set: async (items) => {
        const next = Object.values(items)[0]!

        if (control.refusing && next.settings.name !== stored.settings.name) {
          throw TOO_OFTEN
        }

        stored = structuredClone(next)
      }
    })

    const { useDayboardState } = await import("./useDayboardState")
    const hook = renderHook(() => useDayboardState())

    await waitFor(() => expect(hook.result.current.state).not.toBeNull())

    return { ...hook, control }
  }

  it("leaves the board's notice out of a name refused while Options shows it", async () => {
    const { result, unmount } = await render()

    let refused: string | null = null
    await act(async () => {
      refused = await result.current.setSettings({ name: "Samantha" }, () => true)
    })

    // Options hears why, to say so beside the name it keeps; the board goes back to what storage holds.
    expect(refused).toBe(TOO_OFTEN_NOTICE)
    expect(result.current.saveError).toBeNull()
    expect(result.current.state!.settings).toEqual({ name: "Sam" })

    unmount()
  })

  it("says on the board why a name refused as Options closed went with it, until the next save lands", async () => {
    const { result, unmount, control } = await render()

    // Sent while Options was open, and answered once it had closed.
    let shown = true
    await act(async () => {
      const saving = result.current.setSettings({ name: "Samantha" }, () => shown)
      shown = false
      await saving
    })
    expect(result.current.saveError).toBe(TOO_OFTEN_NOTICE)

    // Nothing on screen holds the name any more, so the notice goes the way any other refusal's does.
    control.refusing = false
    await act(async () => {
      await result.current.updateWidget({ ...habit, settings: { history: ["2026-10-05"] } })
    })
    expect(result.current.saveError).toBeNull()

    unmount()
  })

  it("writes nothing for a name typed back to what is stored", async () => {
    const { result, unmount } = await render()

    let refused: string | null = "unset"
    await act(async () => {
      refused = await result.current.setSettings({ name: "Sam" }, () => true)
    })

    expect(refused).toBeNull()
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()

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
