import {
  DEFAULT_COLORS,
  DEFAULT_TIME_ZONE,
  toDateTimeInputValue,
  type BoardItem,
  type ClockFormat,
  type ItemKind
} from "./types"

export const createBoardItem = (
  kind: ItemKind,
  existingCount: number,
  now = new Date()
): BoardItem => {
  const timestamp = now.toISOString()
  const color = DEFAULT_COLORS[existingCount % DEFAULT_COLORS.length]

  if (kind === "clock") {
    return {
      id: crypto.randomUUID(),
      kind: "clock",
      title: "New clock",
      timeZone: DEFAULT_TIME_ZONE,
      color,
      format: "12h",
      showSeconds: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  }

  const target = new Date(now)
  target.setHours(target.getHours() + 1, 0, 0, 0)

  return {
    id: crypto.randomUUID(),
    kind: "countdown",
    title: "New countdown",
    timeZone: DEFAULT_TIME_ZONE,
    color,
    targetDateTime: toDateTimeInputValue(target),
    showSeconds: true,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export const updateBoardItem = (
  item: BoardItem,
  changes: Partial<BoardItem>
): BoardItem => {
  const updatedAt = new Date().toISOString()

  if (item.kind === "clock") {
    return {
      ...item,
      ...changes,
      kind: "clock",
      format: normalizeClockFormat(changes.format, item.format),
      updatedAt
    }
  }

  return {
    ...item,
    ...changes,
    kind: "countdown",
    updatedAt
  }
}

const normalizeClockFormat = (
  value: unknown,
  fallback: ClockFormat
): ClockFormat => (value === "24h" || value === "12h" ? value : fallback)
