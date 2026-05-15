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

export const moveBoardItem = (
  items: BoardItem[],
  id: string,
  direction: -1 | 1
): BoardItem[] => {
  const index = items.findIndex((item) => item.id === id)
  const nextIndex = index + direction

  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
    return items
  }

  const nextItems = [...items]
  const [item] = nextItems.splice(index, 1)

  if (!item) {
    return items
  }

  nextItems.splice(nextIndex, 0, item)
  return nextItems
}
