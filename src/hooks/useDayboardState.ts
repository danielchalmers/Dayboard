import { useCallback, useEffect, useRef, useState } from "react"

import {
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
  const [state, setState] = useState<DayboardState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Track the latest state so saveState can roll back without depending on it.
  const stateRef = useRef(state)
  stateRef.current = state

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setState(await readDayboardState())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load data")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const stopWatching = watchDayboardState((nextState) => {
      setState(nextState)
      setIsLoading(false)
      setError(null)
    })

    return () => {
      stopWatching()
    }
  }, [])

  const saveState = useCallback(async (nextState: DayboardState) => {
    const previous = stateRef.current
    setState(nextState)
    setSaveError(null)

    try {
      await writeDayboardState(nextState)
    } catch {
      // The optimistic update never persisted (e.g. chrome.storage.sync quota
      // or write-rate limit). Roll back so the UI matches storage and surface a
      // calm notice instead of silently diverging.
      if (previous) {
        setState(previous)
      }
      setSaveError("Couldn’t save — this board may be too large to sync.")
    }
  }, [])

  const dismissSaveError = useCallback(() => setSaveError(null), [])

  // Read state through the ref so these stay referentially stable across
  // renders, which lets the memoized board rows skip unrelated re-renders.
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
