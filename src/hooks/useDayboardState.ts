import { useCallback, useEffect, useRef, useState } from "react"

import {
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
  setSettings: Save<DayboardSettings>
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

export const useDayboardState = (): UseDayboardStateResult => {
  // Hydrate the first render synchronously from the localStorage mirror so the board paints immediately; the async chrome.storage read reconciles after.
  const [state, setState] = useState<DayboardState | null>(readCachedDayboardState)
  const [isLoading, setIsLoading] = useState(state === null)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // The latest board, for the callbacks below to build on without depending on it.
  // It moves the moment a change is made rather than on the next render: two changes in one tick (two timers finishing together) would otherwise both start from the board before either, and the second would write the first one back out.
  const stateRef = useRef(state)

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

  useEffect(() => {
    void reload()
  }, [reload])

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

  const saveState = useCallback(
    async (nextState: DayboardState) => {
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
        setSaveError(reason)
        return reason
      }

      // The notice stays up until something actually saves, rather than blinking off at the start of every attempt, a retry refused again included.
      setSaveError(null)
      return null
    },
    [adopt, commit]
  )

  const dismissSaveError = useCallback(() => setSaveError(null), [])

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

  const setSettings = useCallback(
    async (settings: DayboardSettings) => {
      const current = stateRef.current
      if (!current) {
        return null
      }

      return saveState({ ...current, settings })
    },
    [saveState]
  )

  const updateWidget = useCallback(
    async (widget: Widget) => {
      const current = stateRef.current

      // A card can report a change after its widget has gone (a note flushing its last keystrokes as it unmounts), and writing the board back unchanged would only spend sync quota.
      if (!current?.widgets.some((existing) => existing.id === widget.id)) {
        return null
      }

      return saveState({
        ...current,
        widgets: current.widgets.map((existing) =>
          existing.id === widget.id ? widget : existing
        )
      })
    },
    [saveState]
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
