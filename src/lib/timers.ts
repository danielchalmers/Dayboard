import type { StopwatchWidget, TimerWidget } from "./types"

type StopwatchSettings = StopwatchWidget["settings"]
type TimerSettings = TimerWidget["settings"]

export interface DurationParts {
  hours: number
  minutes: number
  seconds: number
}

// Format a millisecond span as H:MM:SS (dropping the hours segment under an
// hour), e.g. 90_000 -> "1:30", 3_661_000 -> "1:01:01".
export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, "0")

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`
}

export const msToParts = (ms: number): DurationParts => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)

  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  }
}

export const partsToMs = ({ hours, minutes, seconds }: DurationParts): number =>
  (hours * 3600 + minutes * 60 + seconds) * 1000

// ── Stopwatch ─────────────────────────────────────────────────────────────

export const stopwatchElapsedMs = (
  settings: StopwatchSettings,
  nowMs: number
): number => {
  const elapsed =
    settings.running && settings.startedAt != null
      ? settings.elapsedMs + (nowMs - settings.startedAt)
      : settings.elapsedMs

  return Math.max(0, elapsed)
}

export const startStopwatch = (
  settings: StopwatchSettings,
  nowMs: number
): StopwatchSettings => ({
  running: true,
  elapsedMs: settings.elapsedMs,
  startedAt: nowMs
})

export const pauseStopwatch = (
  settings: StopwatchSettings,
  nowMs: number
): StopwatchSettings => ({
  running: false,
  elapsedMs: stopwatchElapsedMs(settings, nowMs),
  startedAt: null
})

export const resetStopwatch = (): StopwatchSettings => ({
  running: false,
  elapsedMs: 0,
  startedAt: null
})

// ── Timer ─────────────────────────────────────────────────────────────────

export const timerRemainingMs = (
  settings: TimerSettings,
  nowMs: number
): number => {
  const remaining =
    settings.running && settings.endsAt != null
      ? settings.endsAt - nowMs
      : settings.remainingMs

  return Math.max(0, remaining)
}

export const startTimer = (
  settings: TimerSettings,
  nowMs: number
): TimerSettings => {
  // Resume from where it was paused, or start a fresh full duration.
  const remaining =
    settings.remainingMs > 0 ? settings.remainingMs : settings.durationMs

  return {
    ...settings,
    running: true,
    remainingMs: remaining,
    endsAt: nowMs + remaining
  }
}

export const pauseTimer = (
  settings: TimerSettings,
  nowMs: number
): TimerSettings => ({
  ...settings,
  running: false,
  remainingMs: timerRemainingMs(settings, nowMs),
  endsAt: null
})

export const resetTimer = (settings: TimerSettings): TimerSettings => ({
  ...settings,
  running: false,
  remainingMs: settings.durationMs,
  endsAt: null
})

// Settle a timer that has counted all the way down.
export const finishTimer = (settings: TimerSettings): TimerSettings => ({
  ...settings,
  running: false,
  remainingMs: 0,
  endsAt: null
})
