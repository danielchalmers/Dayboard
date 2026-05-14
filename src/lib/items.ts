import {
  DEFAULT_COLORS,
  DEFAULT_TIME_ZONE,
  toDateTimeInputValue,
  type BoardItem,
  type ItemKind
} from "./types"

export const createBoardItem = (
  kind: ItemKind,
  existingCount: number,
  now = new Date()
): BoardItem => {
  const timestamp = now.toISOString()
  const color = DEFAULT_COLORS[existingCount % DEFAULT_COLORS.length]!

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
