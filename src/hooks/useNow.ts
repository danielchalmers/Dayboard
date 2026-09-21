import { useCallback, useMemo, useSyncExternalStore } from "react"

import {
  floorToGranularity,
  readClock,
  subscribeToClock,
  type ClockGranularity
} from "~/lib/clock"

// The current time, floored to the granularity the caller reads it at, from the page's shared clock (`~/lib/clock`).
// The component re-renders only when that floored value moves: a clock card at "minute" renders once a minute, a habit card at "day" once at midnight, and nothing else on the page renders for either.
export const useNow = (granularity: ClockGranularity = "minute"): Date => {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToClock(listener, granularity),
    [granularity]
  )
  const ms = useSyncExternalStore(subscribe, () =>
    floorToGranularity(readClock(), granularity)
  )

  return useMemo(() => new Date(ms), [ms])
}
