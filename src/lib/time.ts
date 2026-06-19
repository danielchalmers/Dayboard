import {
  toDateTimeInputValue,
  type ClockWidget,
  type CountdownRepeat,
  type CountdownWidget
} from "./types"

export interface CountdownParts {
  status: "future" | "due" | "past"
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
  label: string
}

export const dateTimeInputValueToIsoInstant = (
  localDateTime: string
): string | null => {
  const match = localDateTime.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  )

  if (!match) {
    return null
  }

  const year = Number(match[1]!)
  const month = Number(match[2]!)
  const day = Number(match[3]!)
  const hour = Number(match[4]!)
  const minute = Number(match[5]!)

  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString()
}

export const isoInstantToDateTimeInputValue = (instant: string): string => {
  const date = new Date(instant)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return toDateTimeInputValue(date)
}

export const formatClockTime = (date: Date, widget: ClockWidget): string =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: widget.settings.timeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(date)

export const formatClockDate = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date)

export const formatTimeZoneName = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone,
    timeZoneName: "short"
  }).formatToParts(date)

  return parts.find((part) => part.type === "timeZoneName")?.value || timeZone
}

// For a repeating countdown, roll the target forward (in calendar steps, so the
// time of day is preserved across DST) to the next occurrence at or after now.
// Non-repeating or still-future targets are returned unchanged.
export const nextCountdownTarget = (
  targetAt: string,
  repeat: CountdownRepeat | undefined,
  now = new Date()
): string => {
  const base = new Date(targetAt)

  if (
    Number.isNaN(base.getTime()) ||
    !repeat ||
    repeat === "none" ||
    base.getTime() > now.getTime()
  ) {
    return targetAt
  }

  const next = new Date(base)
  const nowMs = now.getTime()
  let guard = 0

  while (next.getTime() <= nowMs && guard < 6000) {
    if (repeat === "daily") {
      next.setDate(next.getDate() + 1)
    } else if (repeat === "weekly") {
      next.setDate(next.getDate() + 7)
    } else if (repeat === "monthly") {
      next.setMonth(next.getMonth() + 1)
    } else {
      next.setFullYear(next.getFullYear() + 1)
    }

    guard += 1
  }

  return next.toISOString()
}

export const getCountdownParts = (
  widget: CountdownWidget,
  now = new Date()
): CountdownParts => {
  const targetMs = new Date(widget.settings.targetAt).getTime()
  const totalMs = targetMs - now.getTime()
  const remainingMs = Math.max(0, Number.isNaN(totalMs) ? 0 : totalMs)
  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  return {
    status: getCountdownStatus(totalMs),
    totalMs,
    days,
    hours,
    minutes,
    seconds,
    label: formatRelativeCountdown(totalMs)
  }
}

export const formatRelativeCountdown = (totalMs: number): string => {
  if (Number.isNaN(totalMs) || Math.abs(totalMs) < 60_000) {
    return totalMs >= 0 || Number.isNaN(totalMs)
      ? "less than a minute from now"
      : "just now"
  }

  const suffix = totalMs >= 0 ? "from now" : "ago"
  const absoluteMinutes = Math.floor(Math.abs(totalMs) / 60_000)
  const days = Math.floor(absoluteMinutes / 1_440)
  const hours = Math.floor((absoluteMinutes % 1_440) / 60)
  const minutes = absoluteMinutes % 60
  const parts: string[] = []

  if (days > 0) {
    parts.push(pluralize(days, "day"))
  }

  if (hours > 0 && parts.length < 2) {
    parts.push(pluralize(hours, "hour"))
  }

  if (minutes > 0 && parts.length < 2) {
    parts.push(pluralize(minutes, "minute"))
  }

  return `${parts.join(", ")} ${suffix}`
}

const getCountdownStatus = (totalMs: number): CountdownParts["status"] => {
  if (Number.isNaN(totalMs) || Math.abs(totalMs) < 60_000) {
    return "due"
  }

  return totalMs > 0 ? "future" : "past"
}

const pluralize = (value: number, unit: string): string =>
  `${value} ${unit}${value === 1 ? "" : "s"}`

// Fraction (0..1) of the way from the widget's start to its target, for the
// progress display. Falls back gracefully when no usable start span exists.
export const getCountdownProgress = (
  widget: CountdownWidget,
  now = new Date()
): number => {
  const target = new Date(widget.settings.targetAt).getTime()
  const start = widget.settings.startAt
    ? new Date(widget.settings.startAt).getTime()
    : Number.NaN

  if (Number.isNaN(target)) {
    return 0
  }

  if (Number.isNaN(start) || start >= target) {
    return now.getTime() >= target ? 1 : 0
  }

  const fraction = (now.getTime() - start) / (target - start)
  return Math.min(1, Math.max(0, fraction))
}

export const formatCountdownTarget = (widget: CountdownWidget): string => {
  const target = new Date(widget.settings.targetAt)

  if (Number.isNaN(target.getTime())) {
    return "Invalid target"
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(target)
}

export const getTimeZoneOptions = (): string[] => {
  const supportedValuesOf = Intl.supportedValuesOf?.bind(Intl)

  if (supportedValuesOf) {
    return supportedValuesOf("timeZone")
  }

  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Australia/Sydney"
  ]
}
