import { useCallback, useEffect, useState } from "react"

import {
  readClockboardState,
  writeClockboardState
} from "~/lib/storage"
import type { BoardItem, ClockboardSettings, ClockboardState } from "~/lib/types"

interface UseClockboardStateResult {
  state: ClockboardState | null
  isLoading: boolean
  error: string | null
  setSettings: (settings: ClockboardSettings) => Promise<void>
  setItems: (items: BoardItem[]) => Promise<void>
  saveState: (nextState: ClockboardState) => Promise<void>
  reload: () => Promise<void>
}

export const useClockboardState = (): UseClockboardStateResult => {
  const [state, setState] = useState<ClockboardState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const saveState = useCallback(async (nextState: ClockboardState) => {
    setState(nextState)
    await writeClockboardState(nextState)
  }, [])

  const setSettings = useCallback(
    async (settings: ClockboardSettings) => {
      if (!state) {
        return
      }

      await saveState({ ...state, settings })
    },
    [saveState, state]
  )

  const setItems = useCallback(
    async (items: BoardItem[]) => {
      if (!state) {
        return
      }

      await saveState({ ...state, items })
    },
    [saveState, state]
  )

  return {
    state,
    isLoading,
    error,
    setSettings,
    setItems,
    saveState,
    reload
  }
}
