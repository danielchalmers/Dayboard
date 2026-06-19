// Helpers for the habit widget. History is a list of local day keys
// (YYYY-MM-DD) on which the habit was marked done.

const pad = (value: number) => String(value).padStart(2, "0")

export const toDayKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export const isDoneOn = (history: string[], date: Date): boolean =>
  history.includes(toDayKey(date))

export const isDoneToday = (history: string[], now: Date): boolean =>
  isDoneOn(history, now)

// History only ever feeds the current streak and the 7-day dot row, so keep a
// generous recent window and let older days fall off — otherwise the list grows
// without bound against the shared sync quota.
const HISTORY_WINDOW_DAYS = 400

const pruneHistory = (history: string[], now: Date): string[] => {
  const cutoff = toDayKey(addDays(now, -HISTORY_WINDOW_DAYS))
  // YYYY-MM-DD keys sort chronologically as strings.
  return history.filter((key) => key >= cutoff)
}

// Mark or unmark today.
export const toggleToday = (history: string[], now: Date): string[] => {
  const key = toDayKey(now)
  const next = history.includes(key)
    ? history.filter((entry) => entry !== key)
    : [...history, key]

  return pruneHistory(next, now)
}

// Consecutive completed days counting back from today. Today still counts as
// part of the streak until it ends, so a streak built through yesterday stays
// alive until the user either completes today or the day passes.
export const currentStreak = (history: string[], now: Date): number => {
  const done = new Set(history)
  let cursor = new Date(now)

  if (!done.has(toDayKey(cursor))) {
    cursor = addDays(cursor, -1)
  }

  let streak = 0
  while (done.has(toDayKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

// The last `count` days, oldest first, for the at-a-glance dot row.
export const recentDays = (now: Date, count: number): Date[] => {
  const days: Date[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(addDays(now, -offset))
  }
  return days
}
