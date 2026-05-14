import type { ClockItem, CountdownItem } from "./types"

export interface CountdownParts {
  status: "future" | "due"
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
  label: string
}

const DATE_PARTS = ["year", "month", "day", "hour", "minute", "second"] as const

type DatePart = (typeof DATE_PARTS)[number]

type DateParts = Record<DatePart, number>

const getPartsInTimeZone = (date: Date, timeZone: string): DateParts => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date)

  return DATE_PARTS.reduce<DateParts>((acc, type) => {
    const value = parts.find((part) => part.type === type)?.value
    acc[type] = Number(value)
    return acc
  }, {} as DateParts)
}

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const parts = getPartsInTimeZone(date, timeZone)
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  return zonedAsUtc - date.getTime()
}

export const zonedDateTimeToUtcMs = (
  localDateTime: string,
  timeZone: string
): number => {
  const match = localDateTime.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  )

  if (!match) {
    return Number.NaN
  }

  const [, year, month, day, hour, minute] = match.map(Number)
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  let guess = localAsUtc

  for (let index = 0; index < 3; index += 1) {
    guess = localAsUtc - getTimeZoneOffsetMs(new Date(guess), timeZone)
  }

  return guess
}

export const formatClockTime = (date: Date, item: ClockItem): string =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: item.timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: item.showSeconds ? "2-digit" : undefined,
    hour12: item.format === "12h"
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

export const getCountdownParts = (
  item: CountdownItem,
  now = new Date()
): CountdownParts => {
  const targetUtcMs = zonedDateTimeToUtcMs(item.targetDateTime, item.timeZone)
  const totalMs = targetUtcMs - now.getTime()
  const remainingMs = Math.max(0, totalMs)
  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  return {
    status: totalMs > 0 ? "future" : "due",
    totalMs,
    days,
    hours,
    minutes,
    seconds,
    label: formatCountdownLabel({ days, hours, minutes, seconds }, item.showSeconds)
  }
}

export const formatCountdownLabel = (
  parts: Pick<CountdownParts, "days" | "hours" | "minutes" | "seconds">,
  showSeconds: boolean
): string => {
  const dayLabel = `${parts.days}d`
  const hourLabel = `${String(parts.hours).padStart(2, "0")}h`
  const minuteLabel = `${String(parts.minutes).padStart(2, "0")}m`
  const secondLabel = `${String(parts.seconds).padStart(2, "0")}s`

  return showSeconds
    ? `${dayLabel} ${hourLabel} ${minuteLabel} ${secondLabel}`
    : `${dayLabel} ${hourLabel} ${minuteLabel}`
}

export const formatCountdownTarget = (item: CountdownItem): string => {
  const utcMs = zonedDateTimeToUtcMs(item.targetDateTime, item.timeZone)

  if (Number.isNaN(utcMs)) {
    return "Invalid target"
  }

  return new Intl.DateTimeFormat(undefined, {
    timeZone: item.timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(utcMs))
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
