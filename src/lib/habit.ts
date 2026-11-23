// Helpers for the habit widget.
// The card shows the current week as a row of dots and nothing else, deliberately no streak counter, because a number that can reset to zero (or be lost to a bug) turns a gentle nudge into a source of anxiety.
// History therefore keeps only the days that row can show, which also keeps it far under the chrome.storage.sync per-item quota that the whole board shares; the original unbounded list eventually blew it and made every save fail.

const pad = (value: number) => String(value).padStart(2, "0")

export const toDayKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const DAYS_PER_WEEK = 7

// The widest span the card can ever draw: the current week's first day through today.
// Days older than that can never render again and don't need to be kept.
export const STORED_DAYS = DAYS_PER_WEEK

const prune = (dayKeys: string[]): string[] =>
  // YYYY-MM-DD keys sort chronologically as strings.
  [...new Set(dayKeys)].sort().slice(-STORED_DAYS)

export const isDoneOn = (history: string[], date: Date): boolean => history.includes(toDayKey(date))

export const isDoneToday = (history: string[], now: Date): boolean => isDoneOn(history, now)

// Mark or unmark a single day: today from the card's button, any earlier day from its own dot.
export const toggleDay = (history: string[], date: Date): string[] => {
  const key = toDayKey(date)
  const next = history.includes(key) ? history.filter((entry) => entry !== key) : [...history, key]

  return prune(next)
}

// Accept whatever shape a stored or imported board carries (the current pruned list, the original unbounded array of every completed day, or junk) so old boards shrink to what the dot rows can show the first time they load.
export const normalizeHistory = (value: unknown): string[] =>
  Array.isArray(value)
    ? prune(
        value.filter(
          (entry): entry is string => typeof entry === "string" && DAY_KEY_PATTERN.test(entry)
        )
      )
    : []

// The week rolls over on Monday, in `Date.getDay` numbering.
// This was read from the locale for a while, which sounds better than it works: the browser exposes no way to see the first-day-of-week a user picked in Windows or macOS, so `Intl.Locale` only ever answers what the region conventionally does, and an en-US board showed Sunday no matter what the machine was set to.
// One fixed, standard week (ISO-8601) beats a guess that can't be corrected without adding a setting.
export const WEEK_START_DAY = 1

// Midnight on the Monday of the week `date` falls in.
export const startOfWeek = (date: Date): Date => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const shift = (start.getDay() - WEEK_START_DAY + DAYS_PER_WEEK) % DAYS_PER_WEEK

  return addDays(start, -shift)
}

// The week the card draws, from Monday to Sunday.
// It holds its shape as the days fill in rather than sliding a day left every midnight.
export const weekDays = (now: Date): Date[] => {
  const start = startOfWeek(now)

  return Array.from({ length: DAYS_PER_WEEK }, (_, day) => addDays(start, day))
}

// A habit card redraws with every tick of the board's clock, and each one formats a week of dates, so the formatters are built once rather than per render.
// The locale can't change without a reload anyway.
const rangeFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric"
})

const dayLabelFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric"
})

const initialFormat = new Intl.DateTimeFormat(undefined, { weekday: "narrow" })

// A quiet label under the dots, such as `Jul 26 – Aug 1`.
export const formatWeekRange = (days: Date[]): string => {
  const first = days[0]
  const last = days[days.length - 1]

  return first && last ? rangeFormat.formatRange(first, last) : ""
}

// The full date a dot stands for, for its accessible name.
export const formatDayLabel = (date: Date): string => dayLabelFormat.format(date)

// The column headers above the dots: one narrow letter per weekday, still named in the user's language even though the week itself always starts on Monday.
// Any Monday works for the headers; 2024-01-01 was one.
export const weekdayInitials = (): string[] =>
  weekDays(new Date(2024, 0, 1)).map((day) => initialFormat.format(day))
