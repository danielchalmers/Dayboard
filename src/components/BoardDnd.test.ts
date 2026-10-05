import type { ClientRect, Collision, DroppableContainer } from "@dnd-kit/core"
import { describe, expect, it } from "vitest"

import { ARCHIVE_DROP_ID, boardCollision } from "./BoardDnd"

const rect = (left: number, top: number, width: number, height: number): ClientRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height
})

// The default board's bottom row at 1440x900, with the archive zone pinned over the bottom of the viewport, below and between the cards.
const droppableRects = new Map([
  ["walk", rect(64, 488, 412, 240)],
  ["year", rect(506, 488, 412, 240)],
  [ARCHIVE_DROP_ID, rect(510, 808, 420, 64)]
])

const droppableContainers = [...droppableRects.keys()].map(
  (id) => ({ id }) as DroppableContainer
)

const collide = ({
  cardAt,
  pointer
}: {
  cardAt: ClientRect
  pointer: { x: number; y: number } | null
}): Collision["id"] | undefined =>
  boardCollision({
    active: { id: "dragged" } as never,
    collisionRect: cardAt,
    droppableRects,
    droppableContainers,
    pointerCoordinates: pointer
  })[0]?.id

describe("boardCollision", () => {
  // A card grabbed by its top edge and carried onto "year" hangs its center far below the pointer, much nearer the zone's center than the card it is aimed at.
  const liftedByTopEdge = rect(506, 630, 412, 240)

  it("reorders onto the card under the pointer even when the lifted card's center sits nearer the archive zone", () => {
    expect(
      collide({ cardAt: liftedByTopEdge, pointer: { x: 712, y: 640 } })
    ).toBe("year")
  })

  it("archives once the pointer is inside the zone, wherever the card was grabbed", () => {
    expect(
      collide({ cardAt: rect(400, 600, 412, 240), pointer: { x: 720, y: 840 } })
    ).toBe(ARCHIVE_DROP_ID)
  })

  it("does not archive with the pointer just outside the zone", () => {
    expect(
      collide({ cardAt: rect(510, 700, 412, 240), pointer: { x: 720, y: 800 } })
    ).not.toBe(ARCHIVE_DROP_ID)
  })

  // The keyboard moves the card from slot to slot with no pointer at all, so it keeps sorting by centers over every target.
  it("sorts a keyboard drag by centers, the zone included", () => {
    expect(
      collide({ cardAt: rect(510, 780, 412, 120), pointer: null })
    ).toBe(ARCHIVE_DROP_ID)
  })
})
