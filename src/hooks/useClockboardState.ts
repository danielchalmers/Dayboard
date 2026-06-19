import { useCallback, useEffect, useRef, useState } from "react"

import {
  readClockboardState,
  watchClockboardState,
  writeClockboardState
} from "~/lib/storage"
import type { ClockboardSettings, ClockboardState, Widget } from "~/lib/types"

interface UseClockboardStateResult {
  state: ClockboardState | null
  isLoading: boolean
  error: string | null
  setWidgets: (widgets: Widget[]) => Promise<void>
  setSettings: (settings: ClockboardSettings) => Promise<void>
  replaceState: (state: ClockboardState) => Promise<void>
  saveError: string | null
  dismissSaveError: () => void
}

export const useClockboardState = (): UseClockboardStateResult => {
  const [state, setState] = useState<ClockboardState | null>(null)
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
      setState(await readClockboardState())
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
    const stopWatching = watchClockboardState((nextState) => {
      setState(nextState)
      setIsLoading(false)
      setError(null)
    })

    return () => {
      stopWatching()
    }
  }, [])

  const saveState = useCallback(async (nextState: ClockboardState) => {
    const previous = stateRef.current
    setState(nextState)
    setSaveError(null)

    try {
      await writeClockboardState(nextState)
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

  const setWidgets = useCallback(
    async (widgets: Widget[]) => {
      if (!state) {
        return
      }

      await saveState({ ...state, widgets })
    },
    [saveState, state]
  )

  const setSettings = useCallback(
    async (settings: ClockboardSettings) => {
      if (!state) {
        return
      }

      await saveState({ ...state, settings })
    },
    [saveState, state]
  )

  return {
    state,
    isLoading,
    error,
    setWidgets,
    setSettings,
    replaceState: saveState,
    saveError,
    dismissSaveError
  }
}
