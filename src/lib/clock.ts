import type { Widget } from "./types"

// One clock for the whole page, ticking as slowly as the cards on it allow.
//
// Clocks and countdowns print minutes, habits and quotes turn over at midnight, and only a running stopwatch or timer moves every second, so a per-second interval at the root was waking the page sixty times for every change it could show.
// Cards subscribe here at the granularity they read the time at; the store keeps a single timeout aimed at the next boundary of the finest one wanted, and stops it altogether while the tab is hidden.

export type ClockGranularity = "second" | "minute" | "day"

const UNIT_MS = { second: 1_000, minute: 60_000 } as const

// Coarsest first, so the finest of a set is the earliest in this order.
const ORDER: ClockGranularity[] = ["second", "minute", "day"]

export const finestGranularity = (
  granularities: Iterable<ClockGranularity>
): ClockGranularity | null => {
  let finest: ClockGranularity | null = null

  for (const granularity of granularities) {
    if (finest === null || ORDER.indexOf(granularity) < ORDER.indexOf(finest)) {
      finest = granularity
    }
  }

  return finest
}

// The start of the unit an instant falls in. Days start at local midnight, which is the day the board reads everywhere else.
export const floorToGranularity = (
  ms: number,
  granularity: ClockGranularity
): number => {
  if (granularity === "day") {
    return new Date(ms).setHours(0, 0, 0, 0)
  }

  const unit = UNIT_MS[granularity]

  return Math.floor(ms / unit) * unit
}

// How long until the next boundary, so a timeout lands on it rather than drifting through it.
export const msUntilNext = (ms: number, granularity: ClockGranularity): number => {
  if (granularity === "day") {
    // setHours(24) rolls to the following local midnight, which keeps DST changes honest: it is a wall-clock target, not "now plus 24 hours".
    const next = new Date(ms)
    next.setHours(24, 0, 0, 0)

    return Math.max(1, next.getTime() - ms)
  }

  const unit = UNIT_MS[granularity]

  return unit - (ms % unit)
}

// What a card needs the clock for.
// Clocks and countdowns print to the minute; a stopwatch or timer only moves while running, and paused it reads nothing from the clock at all; habits and quotes want local midnight; notes and todos never look, so a daily wake costs them nothing.
export const widgetClockGranularity = (widget: Widget): ClockGranularity => {
  switch (widget.kind) {
    case "clock":
    case "countdown":
      return "minute"
    case "stopwatch":
    case "timer":
      return widget.settings.running ? "second" : "day"
    default:
      return "day"
  }
}

type Listener = () => void

const listeners = new Map<Listener, ClockGranularity>()
let current = Date.now()
let timer: ReturnType<typeof setTimeout> | undefined

const isHidden = () =>
  typeof document !== "undefined" && document.visibilityState === "hidden"

const clearTimer = () => {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
}

// Take the time and tell every subscriber; each one compares its own floored snapshot and re-renders only if that moved.
const refresh = () => {
  current = Date.now()
  listeners.forEach((_, listener) => listener())
}

const schedule = () => {
  clearTimer()

  const granularity = finestGranularity(listeners.values())

  // Nothing is listening, or nothing can be seen: a hidden tab does not need to keep time until it is looked at again.
  if (granularity === null || isHidden()) {
    return
  }

  timer = setTimeout(tick, msUntilNext(Date.now(), granularity))
}

const tick = () => {
  timer = undefined
  refresh()
  schedule()
}

// Coming back to the tab catches the clock up at once rather than at the next boundary, so a clock never shows the minute the tab was hidden on.
const handleVisibilityChange = () => {
  if (isHidden()) {
    clearTimer()
    return
  }

  tick()
}

// The current instant as of the last tick. Stable between ticks, which is what lets subscribers compare snapshots instead of re-rendering on every read.
export const readClock = (): number => current

export const subscribeToClock = (
  listener: Listener,
  granularity: ClockGranularity
): (() => void) => {
  if (listeners.size === 0 && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange)
  }

  listeners.set(listener, granularity)
  // A card that starts wanting seconds should not wait out the rest of the minute the store was parked on.
  refresh()
  schedule()

  return () => {
    listeners.delete(listener)

    if (listeners.size === 0) {
      clearTimer()

      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange)
      }

      return
    }

    schedule()
  }
}
