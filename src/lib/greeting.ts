// The three moments of the day the greeting keys off.
// There is no "night": "Good night" is what you say when parting or heading to bed, so a tab opened at 23:40 to start something would read as being sent to sleep.
// Evening simply runs on until the morning does.
export type Daypart = "morning" | "afternoon" | "evening"

export const getDaypart = (now: Date): Daypart => {
  const hour = now.getHours()

  if (hour >= 5 && hour < 12) {
    return "morning"
  }

  if (hour >= 12 && hour < 17) {
    return "afternoon"
  }

  return "evening"
}

export const getTimeOfDayGreeting = (now: Date): string => {
  switch (getDaypart(now)) {
    case "morning":
      return "Good morning"
    case "afternoon":
      return "Good afternoon"
    case "evening":
      return "Good evening"
  }
}

export const getGreeting = (now: Date, name = ""): string => {
  const base = getTimeOfDayGreeting(now)
  const trimmed = name.trim()

  return trimmed ? `${base}, ${trimmed}` : base
}

// The header redraws with every tick of the board's clock, and constructing a formatter is far pricier than formatting with one, so it is built once.
// The locale can't change without a reload anyway.
const headerDateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric"
})

// The friendly date line under the greeting, e.g. "Monday, July 7".
export const getHeaderDate = (now: Date): string => headerDateFormat.format(now)
