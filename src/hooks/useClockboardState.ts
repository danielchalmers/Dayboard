import { useCallback, useEffect, useState } from "react"

import {
  readClockboardState,
  writeClockboardState
} from "~/lib/storage"
import type { ClockboardState, Widget } from "~/lib/types"

interface UseClockboardStateResult {
  state: ClockboardState | null
  isLoading: boolean
  error: string | null
  setWidgets: (widgets: Widget[]) => Promise<void>
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

  const setWidgets = useCallback(
    async (widgets: Widget[]) => {
      if (!state) {
        return
      }

      await saveState({ ...state, widgets })
    },
    [saveState, state]
  )

  return {
    state,
    isLoading,
    error,
    setWidgets,
    saveState,
    reload
  }
}
