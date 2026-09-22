import { useCallback, useEffect, useRef, useState } from "react"

import {
  readCachedDayboardState,
  readDayboardState,
  watchDayboardState,
  writeDayboardState
} from "~/lib/storage"
import type { DayboardSettings, DayboardState, Widget } from "~/lib/types"

interface UseDayboardStateResult {
  state: DayboardState | null
  isLoading: boolean
  error: string | null
  setWidgets: (widgets: Widget[]) => Promise<void>
  setSettings: (settings: DayboardSettings) => Promise<void>
  updateWidget: (widget: Widget) => Promise<void>
  replaceState: (state: DayboardState) => Promise<void>
  saveError: string | null
  dismissSaveError: () => void
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

  const reload = useCallback(async () => {
    try {
      commit(await readDayboardState())
      setError(null)
    } catch (cause) {
      // A cached board on screen beats a blocking error page, so only surface the failure when there is nothing to show.
      if (!stateRef.current) {
        setError(cause instanceof Error ? cause.message : "Unable to load data")
      }
    } finally {
      setIsLoading(false)
    }
  }, [commit])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const stopWatching = watchDayboardState((nextState) => {
      commit(nextState)
      setIsLoading(false)
      setError(null)
    })

    return () => {
      stopWatching()
    }
  }, [commit])

  const saveState = useCallback(
    async (nextState: DayboardState) => {
      const previous = stateRef.current
      commit(nextState)
      setSaveError(null)

      try {
        await writeDayboardState(nextState)
      } catch {
        // The optimistic update never persisted (e.g. chrome.storage.sync quota or write-rate limit).
        // Roll back so the UI matches storage and surface a calm notice instead of silently diverging.
        if (previous) {
          commit(previous)
        }
        setSaveError("Couldn’t save — this board may be too large to sync.")
      }
    },
    [commit]
  )

  const dismissSaveError = useCallback(() => setSaveError(null), [])

  // Read state through the ref so these stay referentially stable across renders, which lets the memoized board rows skip unrelated re-renders.
  const setWidgets = useCallback(
    async (widgets: Widget[]) => {
      const current = stateRef.current
      if (!current) {
        return
      }

      await saveState({ ...current, widgets })
    },
    [saveState]
  )

  const setSettings = useCallback(
    async (settings: DayboardSettings) => {
      const current = stateRef.current
      if (!current) {
        return
      }

      await saveState({ ...current, settings })
    },
    [saveState]
  )

  const updateWidget = useCallback(
    async (widget: Widget) => {
      const current = stateRef.current
      if (!current) {
        return
      }

      await saveState({
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
