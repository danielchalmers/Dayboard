import {
  toDateTimeInputValue,
  type ClockWidget,
  type CountdownRepeat,
  type CountdownWidget
} from "./types"

export interface CountdownParts {
  /** "today" is a date countdown on its own day, which has no time left to count either way. */
  status: "future" | "due" | "today" | "past"
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

  // The pattern only checks the shape, and `Date` would roll an impossible part forward (February 30 becoming March 2), so check the parts are a real date and time first.
  const calendarDate = new Date(Date.UTC(2000, 0, 1))
  calendarDate.setUTCFullYear(year, month - 1, day)
  if (
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null
  }

  const local = new Date(year, month - 1, day, hour, minute, 0, 0)

  // `new Date(year, ...)` reads a year under 100 as 1900-something, so a target typed as the year 50 would be stored as 1950; setting the year back puts it where it was typed.
  local.setFullYear(year)

  return local.toISOString()
}

export const isoInstantToDateTimeInputValue = (instant: string): string => {
  const date = new Date(instant)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return toDateTimeInputValue(date)
}

// Whether two instants land on the same day of the user's local calendar.
// Widgets that only care which day it is compare ticks with this, so they notice midnight without re-rendering on every second in between.
export const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear()

// Intl.DateTimeFormat construction parses options on every call and is among the pricier locale operations; format() itself is cheap.
// Cache instances by their options so repeated renders (and ticking clocks) reuse one formatter.
const formatterCache = new Map<string, Intl.DateTimeFormat>()

// A clock's time zone is typed free-hand, so a card can be carrying a string that is not a real IANA zone, and asking Intl for a formatter on one throws a RangeError.
// Every clock formatter is called from render, so that throw would take the whole board down rather than the one card; fall back to the local zone instead, and cache the fallback under the same key so a mistyped zone costs one failed construction rather than one per tick.
const createFormatter = (
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat => {
  try {
    return new Intl.DateTimeFormat(undefined, options)
  } catch {
    // The zone is the only part of these options that comes from anyone's typing, so dropping it is the one thing left to try.
    const { timeZone, ...withoutTimeZone } = options

    return new Intl.DateTimeFormat(undefined, withoutTimeZone)
  }
}

const getFormatter = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const key = JSON.stringify(options)
  let formatter = formatterCache.get(key)

  if (!formatter) {
    formatter = createFormatter(options)
    formatterCache.set(key, formatter)
  }

  return formatter
}

// Whether the browser recognizes a saved zone at all, so a card can say it is showing local time instead of quietly passing local time off as somewhere else.
// Cached alongside the formatters, and for the same reason: the check builds a formatter, and clocks ask on every tick.
const knownTimeZones = new Map<string, boolean>()

export const isKnownTimeZone = (timeZone: string): boolean => {
  let known = knownTimeZones.get(timeZone)

  if (known === undefined) {
    try {
      void new Intl.DateTimeFormat(undefined, { timeZone })
      known = true
    } catch {
      known = false
    }

    knownTimeZones.set(timeZone, known)
  }

  return known
}

// The zone the device is in right now, asked fresh on every call rather than once at module load.
// An empty zone on a clock means "follow the system", and following means noticing: resolving here is what lets an open tab pick up the machine changing zones (travel, DST regions), because the resolved name keys a fresh cached formatter.
export const getSystemTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

export const formatClockTime = (date: Date, widget: ClockWidget): string =>
  getFormatter({
    timeZone: widget.settings.timeZone || getSystemTimeZone(),
    hour: "numeric",
    minute: "2-digit"
  }).format(date)

export const formatClockDate = (date: Date, timeZone: string): string =>
  getFormatter({
    timeZone: timeZone || getSystemTimeZone(),
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date)

export const formatTimeZoneName = (date: Date, timeZone: string): string => {
  const parts = getFormatter({
    timeZone: timeZone || getSystemTimeZone(),
    timeZoneName: "short"
  }).formatToParts(date)

  return parts.find((part) => part.type === "timeZoneName")?.value || timeZone
}

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

// How many days a month holds, asked without `new Date(year, ...)`, whose two-digit-year rule would read a year under 100 as 1900-something.
const daysInMonth = (year: number, month: number): number => {
  const probe = new Date()

  // Day 0 of the following month is the last day of this one.
  probe.setFullYear(year, month + 1, 0)

  return probe.getDate()
}

// Land on the same day number in another month, or on that month's last day when it is too short to hold it.
// Assigning the day straight through would overflow instead: Jan 31 plus a month reads as Feb 31, which `Date` rolls on to Mar 3, moving a monthly countdown off February altogether.
// Clamping keeps the 31st on the 28th in February and back on the 31st in March, rather than drifting further every cycle, because each step is measured from the original target.
const setMonthClamped = (date: Date, year: number, month: number): void => {
  date.setFullYear(year, month, Math.min(date.getDate(), daysInMonth(year, month)))
}

// Move an instant forward by whole repeat steps, using calendar arithmetic so the time of day survives DST and a monthly countdown keeps its day number instead of drifting the way repeated single steps would.
const advanceByRepeat = (
  base: Date,
  repeat: CountdownRepeat | undefined,
  steps: number
): Date => {
  const next = new Date(base)

  if (!repeat || repeat === "none" || steps <= 0) {
    return next
  }

  if (repeat === "hourly") {
    // An hour is an hour. Stepping the local hour field instead would skip an occurrence every autumn, when a DST fall-back replays the same wall-clock hour and the second pass through it is never landed on.
    next.setTime(next.getTime() + steps * HOUR_MS)
  } else if (repeat === "daily") {
    next.setDate(next.getDate() + steps)
  } else if (repeat === "weekly") {
    next.setDate(next.getDate() + steps * 7)
  } else if (repeat === "monthly") {
    setMonthClamped(next, next.getFullYear(), next.getMonth() + steps)
  } else {
    setMonthClamped(next, next.getFullYear() + steps, next.getMonth())
  }

  return next
}

const APPROXIMATE_STEP_MS: Record<Exclude<CountdownRepeat, "none">, number> = {
  hourly: HOUR_MS,
  daily: 86_400_000,
  weekly: 604_800_000,
  monthly: 2_629_746_000,
  yearly: 31_556_952_000
}

// How many repeat steps a stored target has to move to land on its first occurrence after now.
// The count is estimated from the elapsed span and then nudged into place, so an hourly countdown left alone for a year costs a couple of comparisons rather than thousands of iterations.
const countdownRepeatSteps = (
  targetAt: string,
  repeat: CountdownRepeat | undefined,
  now: Date
): number => {
  const base = new Date(targetAt)

  if (
    Number.isNaN(base.getTime()) ||
    !repeat ||
    repeat === "none" ||
    base.getTime() > now.getTime()
  ) {
    return 0
  }

  let steps = Math.max(
    0,
    Math.floor((now.getTime() - base.getTime()) / APPROXIMATE_STEP_MS[repeat])
  )

  while (advanceByRepeat(base, repeat, steps).getTime() <= now.getTime()) {
    steps += 1
  }

  while (
    steps > 0 &&
    advanceByRepeat(base, repeat, steps - 1).getTime() > now.getTime()
  ) {
    steps -= 1
  }

  return steps
}

const startOfLocalDay = (date: Date): Date => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  return start
}

const isLocalMidnight = (date: Date): boolean =>
  date.getTime() === startOfLocalDay(date).getTime()

// Days between two instants on the local calendar, counted in midnights rather than 24-hour blocks, so a DST change (a 23- or 25-hour day) doesn't land the count a day short or long.
const calendarDaysBetween = (from: Date, to: Date): number =>
  Math.round(
    (startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY_MS
  )

// Whole months from one instant to a later one, stepped the way a monthly repeat steps, so the 31st is a month from the last day of a shorter month.
// Estimated from the span and then nudged into place, the same as the repeat steps above.
const wholeMonthsBetween = (from: Date, to: Date): number => {
  let months = Math.max(
    0,
    Math.floor((to.getTime() - from.getTime()) / APPROXIMATE_STEP_MS.monthly)
  )

  while (advanceByRepeat(from, "monthly", months + 1).getTime() <= to.getTime()) {
    months += 1
  }

  while (months > 0 && advanceByRepeat(from, "monthly", months).getTime() > to.getTime()) {
    months -= 1
  }

  return months
}

// A target at local midnight is a date rather than a moment: a birthday, a trip, New Year's Day.
// It counts in calendar days and lasts the whole of its day, which is how people count to a date, and the dialog's When field starts there so a picked date stays one.
// An hourly or daily repeat is never a date: it comes round every day, so a day-long occurrence would leave it reading Today for good rather than counting down to midnight.
const isDate = (target: Date, repeat: CountdownRepeat | undefined): boolean =>
  !Number.isNaN(target.getTime()) &&
  isLocalMidnight(target) &&
  repeat !== "hourly" &&
  repeat !== "daily"

const isDateCountdown = (widget: CountdownWidget): boolean =>
  isDate(new Date(widget.settings.targetAt), widget.settings.repeat)

// Resolve what a countdown means right now: a repeating one shows its next occurrence, and a start that cannot fill a bar is dropped.
// Both ends of a repeating span move together so the bar keeps its length each cycle instead of stretching from the original start forever.
// The result is computed on the fly, so the stored widget stays the anchor and every tab agrees without writes.
export const resolveCountdown = (
  widget: CountdownWidget,
  now = new Date()
): CountdownWidget => {
  const { targetAt, startAt, repeat } = widget.settings
  const target = new Date(targetAt)

  // Nothing to resolve against an unreadable target; the card says so instead.
  if (Number.isNaN(target.getTime())) {
    return widget
  }

  const start = startAt ? new Date(startAt) : null
  let steps = countdownRepeatSteps(targetAt, repeat, now)

  // A start that does not parse, or that does not sit before the target, is not a span a bar can fill; the card falls back to the remaining-time text.
  const hasSpan =
    start !== null &&
    !Number.isNaN(start.getTime()) &&
    start.getTime() < target.getTime()

  // The steps land on the first occurrence still ahead, but two kinds of occurrence outlast their target, so stay on the one just passed while it lasts.
  if (steps > 0) {
    if (hasSpan && start) {
      // A finished span stays full until the next one starts, so a workday bar reads Complete through the evening rather than an empty bar with nineteen hours to go.
      // Spans that run straight into each other, like the year card, have no gap to hold and roll on at once.
      if (now.getTime() < advanceByRepeat(start, repeat, steps).getTime()) {
        steps -= 1
      }
    } else {
      // A date lasts all day, so a birthday reads Today until midnight rather than a year away the moment it begins.
      const previous = advanceByRepeat(target, repeat, steps - 1)
      const dayAfter = new Date(previous)
      dayAfter.setDate(dayAfter.getDate() + 1)

      if (isDate(previous, repeat) && now.getTime() < dayAfter.getTime()) {
        steps -= 1
      }
    }
  }

  if (steps === 0 && hasSpan === Boolean(startAt)) {
    return widget
  }

  return {
    ...widget,
    settings: {
      ...widget.settings,
      targetAt: advanceByRepeat(target, repeat, steps).toISOString(),
      startAt:
        hasSpan && start
          ? advanceByRepeat(start, repeat, steps).toISOString()
          : undefined
    }
  }
}

export const getCountdownParts = (
  widget: CountdownWidget,
  now = new Date()
): CountdownParts => {
  const target = new Date(widget.settings.targetAt)
  const totalMs = target.getTime() - now.getTime()

  if (isDateCountdown(widget)) {
    const days = calendarDaysBetween(now, target)

    if (days === 0) {
      return { status: "today", label: "Today" }
    }

    // On any day but the eve, a date is whole days away, counted from the start of today so the hour doesn't matter: Christmas is 79 days off all of October 7.
    // The eve itself falls through to hours and minutes, so New Year's Eve still ticks down to midnight.
    if (days !== 1) {
      const today = startOfLocalDay(now)
      const years =
        days > 0 ? describeYears(today, target) : describeYears(target, today)

      return {
        status: days > 0 ? "future" : "past",
        label: `${years ?? pluralize(Math.abs(days), "day")} ${days > 0 ? "from now" : "ago"}`
      }
    }
  }

  const status = getCountdownStatus(totalMs)
  const years =
    status === "future"
      ? describeYears(now, target)
      : status === "past"
        ? describeYears(target, now)
        : null

  return {
    status,
    label: years
      ? `${years} ${status === "future" ? "from now" : "ago"}`
      : formatRelativeCountdown(totalMs)
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

  return `${describeUnits([
    [Math.floor(absoluteMinutes / 1_440), "day"],
    [Math.floor((absoluteMinutes % 1_440) / 60), "hour"],
    [absoluteMinutes % 60, "minute"]
  ])} ${suffix}`
}

// A span of a year or more reads in years and months ("29 years, 11 months"), the way people say it, rather than in thousands of days.
// Null under a year, where days and hours are still the units that move.
const describeYears = (from: Date, to: Date): string | null => {
  const months = wholeMonthsBetween(from, to)

  if (months < 12) {
    return null
  }

  return describeUnits([
    [Math.floor(months / 12), "year"],
    [months % 12, "month"]
  ])
}

// The two largest units that aren't zero, so an empty unit is skipped rather than shown: "2 days, 9 minutes", never "2 days, 0 hours".
const describeUnits = (units: [value: number, unit: string][]): string =>
  units
    .filter(([value]) => value > 0)
    .slice(0, 2)
    .map(([value, unit]) => pluralize(value, unit))
    .join(", ")

const getCountdownStatus = (totalMs: number): CountdownParts["status"] => {
  if (Number.isNaN(totalMs) || Math.abs(totalMs) < 60_000) {
    return "due"
  }

  return totalMs > 0 ? "future" : "past"
}

const pluralize = (value: number, unit: string): string =>
  `${value} ${unit}${value === 1 ? "" : "s"}`

// Fraction (0..1) of the way from the widget's start to its target, for the progress display.
// Falls back gracefully when no usable start span exists.
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

// Whole-percent form of that fraction, for the number and the bar.
// Nearest is right through the middle, but both ends have to be exact.
// Rounding 99.7% up to 100% tells someone a countdown is over while hours are still on the clock, and rounding a freshly started 0.3% down says it never began.
export const getCountdownPercent = (fraction: number): number => {
  if (Number.isNaN(fraction)) {
    return 0
  }

  if (fraction >= 1) {
    return 100
  }

  if (fraction <= 0) {
    return 0
  }

  return Math.min(99, Math.max(1, Math.round(fraction * 100)))
}

// The detail line reads the way a date is written by hand: a date has no "12:00 AM", and the year appears once it isn't this one.
// A repeating countdown leaves the year off, since its next occurrence is always the coming one.
export const formatCountdownTarget = (
  widget: CountdownWidget,
  now = new Date()
): string => {
  const target = new Date(widget.settings.targetAt)

  if (Number.isNaN(target.getTime())) {
    return "Invalid target"
  }

  const { repeat } = widget.settings
  const showsYear =
    (!repeat || repeat === "none") && target.getFullYear() !== now.getFullYear()

  return getFormatter({
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(showsYear ? { year: "numeric" } : {}),
    ...(isDateCountdown(widget) ? {} : { hour: "numeric", minute: "2-digit" })
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
