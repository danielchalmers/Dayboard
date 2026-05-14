import {
  DEFAULT_TIME_ZONE,
  toDateTimeInputValue,
  type BoardItem,
  type ItemKind
} from "./types"

export const createBoardItem = (
  kind: ItemKind,
  now = new Date()
): BoardItem => {
  const timestamp = now.toISOString()

  if (kind === "clock") {
    return {
      id: crypto.randomUUID(),
      kind: "clock",
      title: "New clock",
      timeZone: DEFAULT_TIME_ZONE,
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
    targetDateTime: toDateTimeInputValue(target),
    createdAt: timestamp,
    updatedAt: timestamp
  }
}
