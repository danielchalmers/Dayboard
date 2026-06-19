// A calm, time-of-day greeting for the board header.
export const getTimeOfDayGreeting = (now: Date): string => {
  const hour = now.getHours()

  if (hour >= 5 && hour < 12) {
    return "Good morning"
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon"
  }

  if (hour >= 17 && hour < 22) {
    return "Good evening"
  }

  return "Good night"
}

// Optionally personalize the greeting with a trimmed name.
export const getGreeting = (now: Date, name = ""): string => {
  const base = getTimeOfDayGreeting(now)
  const trimmed = name.trim()

  return trimmed ? `${base}, ${trimmed}` : base
}
