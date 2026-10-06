import { useCallback, useEffect, useRef, useState } from "react"

import {
  isSameData,
  readCachedDayboardState,
  readDayboardState,
  shareUnchanged,
  watchDayboardState,
  writeDayboardState
} from "~/lib/storage"
import type { DayboardSettings, DayboardState, Widget } from "~/lib/types"

// Each change resolves to why storage refused it, or null once it is saved (or there was nothing to save), so whatever the user typed for it can be held on to until it lands.
type Save<T> = (value: T) => Promise<string | null>

interface UseDayboardStateResult {
  state: DayboardState | null
  isLoading: boolean
  error: string | null
  setWidgets: Save<Widget[]>
  setSettings: (settings: DayboardSettings, isShown?: () => boolean) => Promise<string | null>
  updateWidget: Save<Widget>
  replaceState: Save<DayboardState>
  saveError: string | null
  dismissSaveError: () => void
}

// chrome.storage.sync refuses a write for two reasons worth telling apart, because they ask opposite things of the user: a board grown past what one sync item holds needs something shortened, while a burst of writes only needs a moment.
// The message is the only place Chrome says which quota it hit, as in "Resource::kQuotaBytesPerItem quota exceeded" or "This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota".
// A wording it doesn't recognise gets no guess at a cause, since a wrong one sends the user off shortening notes for nothing.
export const describeSaveError = (cause: unknown): string => {
  const message = cause instanceof Error ? cause.message : String(cause)

  if (/quota_?bytes/i.test(message)) {
    return "Couldn’t save — that’s more than browser sync can hold. Try shortening a long note or list."
  }

  if (/write_?operations/i.test(message)) {
    return "Couldn’t save — too many changes in a row. Give it a moment, then try again."
  }

  return "Couldn’t save that change. Try again in a moment."
}

// A promise and the function that settles it, for a wait set up before the work it waits on can start.
const deferred = () => {
  let settle = () => {}
  const promise = new Promise<void>((resolve) => {
    settle = resolve
  })

  return { promise, settle }
}

export const useDayboardState = (): UseDayboardStateResult => {
  // Hydrate the first render synchronously from the localStorage mirror so the board paints immediately; the async chrome.storage read reconciles after.
  const [state, setState] = useState<DayboardState | null>(readCachedDayboardState)
  const [isLoading, setIsLoading] = useState(state === null)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // The latest board, for the callbacks below to build on without depending on it.
  // It moves the moment a change is made rather than on the next render: two changes in one tick (two timers finishing together) would otherwise both start from the board before either, and the second would write the first one back out.
  const stateRef = useRef(state)

  // Notes still showing words storage refused, by id.
  // Every other card shows what the board rolled back to, but a note keeps refused words on screen (see NoteField), so the notice stays up until each of them has saved or let its words go rather than going at the first unrelated save that lands.
  const heldRef = useRef(new Set<string>())

  // The board painted from the localStorage mirror is only as new as the last board tab here left it, so storage may have moved on since (on another device, while no board tab was open here), and only the first read can say.
  // That read is armed with the first render rather than when the effect below starts it, because a card's effects run before this hook's, and a timer that ran out meanwhile settles in that same first commit.
  const [firstRead] = useState(deferred)

  // Until it lands, the read that brings this tab up to date with storage: the first one, or one started as the tab wakes from being frozen (see updateWidget).
  const catchingUpRef = useRef<Promise<void> | null>(firstRead.promise)

  const commit = useCallback((next: DayboardState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Reads and storage changes keep every widget object that did not change, so the memoized cards only render for the ones that did.
  const adopt = useCallback(
    (incoming: DayboardState) => {
      const next = shareUnchanged(stateRef.current, incoming)

      if (next !== stateRef.current) {
        commit(next)
      }
    },
    [commit]
  )

  const reload = useCallback(async () => {
    try {
      adopt(await readDayboardState())
      setError(null)
    } catch (cause) {
      // A cached board on screen beats a blocking error page, so only surface the failure when there is nothing to show.
      if (!stateRef.current) {
        setError(cause instanceof Error ? cause.message : "Unable to load data")
      }
    } finally {
      setIsLoading(false)
    }
  }, [adopt])

  // Holds a card's changes until `reading` lands (see updateWidget).
  const catchUpWith = useCallback((reading: Promise<void>) => {
    catchingUpRef.current = reading
    void reading.finally(() => {
      if (catchingUpRef.current === reading) {
        catchingUpRef.current = null
      }
    })
  }, [])

  // The first read, armed above, starts here.
  useEffect(() => {
    catchUpWith(firstRead.promise)
    void reload().then(firstRead.settle)
  }, [catchUpWith, firstRead, reload])

  useEffect(() => {
    const stopWatching = watchDayboardState((nextState) => {
      adopt(nextState)
      setIsLoading(false)
      setError(null)
    })

    return () => {
      stopWatching()
    }
  }, [adopt])

  // Chrome freezes a tab left in the background (energy saver, Edge's sleeping tabs), and it wakes holding the board it froze with.
  // The changes other tabs made meanwhile are queued for it, but they are delivered only after its own wake-up work has run, and coming back into view is part of that: the clock catches up first, and a timer that ran out while the tab slept would settle from the old board and write it back over everything since.
  // A read started on waking is answered after those queued changes, so until it lands a card's change waits for it (see updateWidget).
  useEffect(() => {
    const catchUp = () => catchUpWith(reload())

    document.addEventListener("resume", catchUp)

    return () => document.removeEventListener("resume", catchUp)
  }, [catchUpWith, reload])

  // `toldBeside` is asked once a refusal comes back, and says whether whatever made the change is still on screen saying why beside it, which leaves the board's notice out of it.
  const saveState = useCallback(
    async (nextState: DayboardState, toldBeside?: () => boolean) => {
      const previous = stateRef.current
      commit(nextState)

      try {
        await writeDayboardState(nextState)
      } catch (cause) {
        // The optimistic update never persisted (e.g. chrome.storage.sync quota or write-rate limit), so put the board back to what storage holds and surface a calm notice instead of silently diverging.
        // Storage is asked rather than the board from before this change being restored, because a later change made while this write was in flight may have landed, and restoring the snapshot would take it off the screen while it sits in storage.
        let restored = previous

        try {
          restored = await readDayboardState()
        } catch {
          // Storage can't be read either, so the snapshot is the best there is.
        }

        if (restored) {
          adopt(restored)
        }

        const reason = describeSaveError(cause)
        if (!toldBeside?.()) {
          setSaveError(reason)
        }
        return reason
      }

      // The notice stays up until something actually saves, rather than blinking off at the start of every attempt, a retry refused again included.
      if (heldRef.current.size === 0) {
        setSaveError(null)
      }

      return null
    },
    [adopt, commit]
  )

  const dismissSaveError = useCallback(() => setSaveError(null), [])

  // A note's refused words have saved, or there is nothing left of them to save, so the notice goes once no other note holds any.
  const release = useCallback((id: string) => {
    if (heldRef.current.delete(id) && heldRef.current.size === 0) {
      setSaveError(null)
    }
  }, [])

  // Read state through the ref so these stay referentially stable across renders, which lets the memoized board rows skip unrelated re-renders.
  const setWidgets = useCallback(
    async (widgets: Widget[]) => {
      const current = stateRef.current
      if (!current) {
        return null
      }

      return saveState({ ...current, widgets })
    },
    [saveState]
  )

  // Only the greeting name is typed into settings.
  // While Options shows it, a refused name stays in its field with the reason under it (see SettingsDialog), so the board's notice stays out of it; refused as Options closes, the words go with the dialog, and the board's notice is what is left to say so.
  const setSettings = useCallback(
    async (settings: DayboardSettings, isShown?: () => boolean) => {
      const current = stateRef.current

      // A name typed back to what is stored has nothing to write.
      if (!current || isSameData(current.settings, settings)) {
        return null
      }

      return saveState({ ...current, settings }, isShown)
    },
    [saveState]
  )

  const updateWidget = useCallback(
    async (widget: Widget) => {
      // A change made before the tab has caught up with storage was worked out from the card as the tab remembered it or froze with it.
      // Once caught up it goes ahead only if that card hasn't changed since; otherwise the card renders as it is now and does over from there whatever still needs doing, rather than settling a timer run another tab or device has already finished and started again.
      if (catchingUpRef.current) {
        const cardIn = (board: DayboardState | null) =>
          board?.widgets.find((candidate) => candidate.id === widget.id)
        const seen = cardIn(stateRef.current)

        await catchingUpRef.current

        if (!isSameData(cardIn(stateRef.current), seen)) {
          release(widget.id)
          return null
        }
      }

      const current = stateRef.current
      const existing = current?.widgets.find((candidate) => candidate.id === widget.id)

      // A card can report a change after its widget has gone (a note flushing its last keystrokes as it unmounts), or one that leaves it as it is (a note typed back to what it held), and writing the board back unchanged would only spend sync quota.
      if (!current || !existing || isSameData(existing.settings, widget.settings)) {
        release(widget.id)
        return null
      }

      // A card only ever changes its own settings, so those are laid over the card as it stands.
      // A note offers refused words again from the copy it last rendered, even as it unmounts on being archived, and writing that whole copy back would undo the archive.
      const refused = await saveState({
        ...current,
        widgets: current.widgets.map((candidate) =>
          candidate === existing
            ? ({ ...existing, settings: widget.settings } as Widget)
            : candidate
        )
      })

      if (!refused) {
        release(widget.id)
      } else if (widget.kind === "note") {
        heldRef.current.add(widget.id)
      }

      return refused
    },
    [release, saveState]
  )

  return {
    state,
    isLoading,
    error,
    setWidgets,
    setSettings,
    updateWidget,
    replaceState: saveState,
    saveError,
    dismissSaveError
  }
}
