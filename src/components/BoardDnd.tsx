import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useEffect, useState, type ReactNode } from "react"

import { BoardRow, BoardRowFallback } from "~/components/BoardRow"
import { CardBoundary } from "~/components/CardBoundary"
import { useNow } from "~/hooks/useNow"
import { widgetClockGranularity } from "~/lib/clock"
import { reorderWidgets, restoreWidget } from "~/lib/widgets"
import type { Widget } from "~/lib/types"

export const ARCHIVE_DROP_ID = "dayboard-archive-dropzone"

// Registered by the active board's empty state, so an archived card can still be dragged home when there are no board cards left to aim at.
export const BOARD_DROP_ID = "dayboard-board-dropzone"

// The archive box, shared with the card menu's Archive item so the action has one glyph wherever it is offered.
// The zone used to draw the lidded bin that the menu keeps for Delete, which read as dropping the card in the trash.
export const ARCHIVE_ICON_PATH =
  "M4.5 5h15a.5.5 0 0 1 .5.5V8H4V5.5a.5.5 0 0 1 .5-.5ZM5 8v10.5a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V8M10 11.5h4"

const isArchiveZone = ({ id }: { id: UniqueIdentifier }) => id === ARCHIVE_DROP_ID

// Cards sort by their centers, which keeps a reorder forgiving about where the card was grabbed.
// The archive zone is different: it claims a drop only while the pointer is inside the box it draws.
// Measured by centers too, it won wherever the lifted card's center sat nearer the zone's than any card's, so a card grabbed by its top edge and carried onto the bottom row was archived instead of moved, with the zone it fell into nowhere near the pointer.
// A keyboard drag has no pointer, so it keeps plain center sorting over everything.
export const boardCollision: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) {
    return closestCenter(args)
  }

  const archiveHit = pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter(isArchiveZone)
  })

  if (archiveHit.length > 0) {
    return archiveHit
  }

  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => !isArchiveZone(container)
    )
  })
}

// The archive drop target only exists mid-drag, pinned to the bottom of the viewport so it is always reachable however tall the board is.
// Restoring has no counterpart zone: an archived card is dropped straight onto the board, into the exact slot it should take.
const ArchiveDropZone = () => {
  const { setNodeRef, isOver } = useDroppable({ id: ARCHIVE_DROP_ID })

  return (
    <div
      ref={setNodeRef}
      className={`archive-dropzone${isOver ? " archive-dropzone--over" : ""}`}
      aria-hidden="true">
      <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
        <path
          d={ARCHIVE_ICON_PATH}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
      <span>{isOver ? "Release to archive" : "Drag here to archive"}</span>
    </div>
  )
}

// A keyboard drag ends on Space, Enter, or Tab and cancels on Escape, a window resize, or the tab being hidden, but on nothing the pointer does.
// So a drag started from the keyboard and then abandoned for the mouse simply stays up: the lifted card hangs over the board, and because a sensor is still holding the drag, every pointer drag after it is refused too, until the user happens to guess Escape.
// Put the card down as soon as attention moves elsewhere.
const EndStrandedKeyboardDrag = () => {
  const { active, activatorEvent } = useDndContext()
  const isKeyboardDrag =
    Boolean(active) && activatorEvent instanceof KeyboardEvent

  useEffect(() => {
    if (!isKeyboardDrag) {
      return
    }

    // The sensor's cancel is Escape on the document, so send one: that takes the normal path (teardown, onDragCancel, focus handed back) instead of needing a back door into dnd-kit.
    const escape = () =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "Escape",
          key: "Escape"
        })
      )

    let retry: number | undefined

    const release = () => {
      escape()
      // The sensor attaches that key listener in a timeout of its own, so for the first task after the drag starts there is nothing listening yet.
      // A second attempt on the next task is guaranteed to land behind it, because the sensor's timeout was queued first.
      window.clearTimeout(retry)
      retry = window.setTimeout(escape)
    }

    // Capture, so the common case releases before dnd-kit's pointer activator sees the press and the same press can start an ordinary drag.
    document.addEventListener("pointerdown", release, true)
    window.addEventListener("blur", release)

    return () => {
      window.clearTimeout(retry)
      document.removeEventListener("pointerdown", release, true)
      window.removeEventListener("blur", release)
    }
  }, [isKeyboardDrag])

  return null
}

// The lifted card keeps time the same way its in-list twin does, from the shared clock at the granularity its kind needs, so the drag context itself never renders for a tick.
const OverlayRow = ({ item }: { item: Widget }) => {
  const now = useNow(widgetClockGranularity(item))

  return (
    <CardBoundary
      fallback={<BoardRowFallback className="board-row--overlay" item={item} />}
      item={item}>
      <BoardRow className="board-row--overlay" item={item} now={now} />
    </CardBoundary>
  )
}

interface BoardDndProps {
  // The full storage list, both boards' cards, so any dragged id resolves.
  widgets: Widget[]
  onReorder?: (activeId: string, overId: string) => void
  // `fromKeyboard` is set when the drag was made with the keys, whose focus went with the card and needs somewhere to land once the card has left its list.
  onArchive?: (id: string, fromKeyboard: boolean) => void
  // `beforeId` is the board card whose slot the restored widget takes; omitted when the drop had no specific target (the empty-board zone).
  onRestore?: (id: string, beforeId: string | undefined, fromKeyboard: boolean) => void
  // Render prop: receives the list to display, which mid-drag may be a preview where the dragged archived card already sits in its board slot.
  children: (widgets: Widget[]) => ReactNode
}

// One drag context shared by the active board and the archived list, so a card can travel between them: an archived card drops onto a specific board slot to restore there, while an active card drops onto the floating archive zone.
export const BoardDnd = ({
  widgets,
  onReorder,
  onArchive,
  onRestore,
  children
}: BoardDndProps) => {
  const [activeId, setActiveId] = useState<string | null>(null)

  // While an archived card hovers over the board, this holds the widgets as if the restore already happened: the card joins the board's sortable list as a placeholder, so the other cards part to make room exactly like a native reorder.
  // Dropping commits it; dragging away or cancelling discards it.
  const [restorePreview, setRestorePreview] = useState<Widget[] | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Any movement at all lifts the card.
      // An 8px threshold meant the pointer ran ahead of the card for the first few pixels of every drag, which reads as lag rather than as a deliberate guard, and the drag handle is the card's own ring, where there is no click for a threshold to protect.
      activationConstraint: {
        distance: 0
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const activeItem = activeId
    ? widgets.find((widget) => widget.id === activeId) ?? null
    : null

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    const dragged = widgets.find((widget) => widget.id === active.id)

    // Only a restore drag crosses lists; board drags keep native sorting.
    // Hovering the card's own slot (its archive origin, or its preview placeholder once slotted in) changes nothing.
    if (!dragged?.archived || over?.id === active.id) {
      return
    }

    if (over?.id === BOARD_DROP_ID) {
      setRestorePreview(restoreWidget(widgets, dragged.id))
      return
    }

    const target = over
      ? widgets.find((widget) => widget.id === over.id)
      : undefined

    if (!target || target.archived) {
      // Back over the archive (or nowhere), so the card returns to its origin.
      setRestorePreview(null)
      return
    }

    // Entering the board: slot the card in before the hovered one.
    // Once it is a member of the board's sortable list, dnd-kit's own sort transforms track the cursor, so the preview must not be rebuilt on every hover.
    setRestorePreview(
      (preview) => preview ?? restoreWidget(widgets, dragged.id, target.id)
    )
  }

  // The preview already encodes the final order; persistence still goes through restoreWidget, so hand back the card in front of which it was dropped.
  const commitRestore = (
    finalOrder: Widget[],
    draggedId: string,
    fromKeyboard: boolean
  ) => {
    const board = finalOrder.filter((widget) => !widget.archived)
    const index = board.findIndex((widget) => widget.id === draggedId)
    onRestore?.(
      draggedId,
      index === -1 ? undefined : board[index + 1]?.id,
      fromKeyboard
    )
  }

  const handleDragEnd = ({ active, over, activatorEvent }: DragEndEvent) => {
    const preview = restorePreview
    const fromKeyboard = activatorEvent instanceof KeyboardEvent
    setActiveId(null)
    setRestorePreview(null)

    if (!over) {
      return
    }

    const dragged = widgets.find((widget) => widget.id === active.id)

    if (!dragged) {
      return
    }

    if (over.id === ARCHIVE_DROP_ID) {
      if (!dragged.archived) {
        onArchive?.(dragged.id, fromKeyboard)
      }
      return
    }

    if (over.id === BOARD_DROP_ID) {
      if (dragged.archived) {
        onRestore?.(dragged.id, undefined, fromKeyboard)
      }
      return
    }

    const target = widgets.find((widget) => widget.id === over.id)

    // A restore drop confirms the preview slot, nudged to the final hovered card if the pointer kept sorting within the board after slotting in.
    if (dragged.archived && preview) {
      if (over.id === active.id) {
        commitRestore(preview, dragged.id, fromKeyboard)
        return
      }

      if (target && !target.archived) {
        commitRestore(
          reorderWidgets(preview, dragged.id, target.id),
          dragged.id,
          fromKeyboard
        )
        return
      }
    }

    if (!target || active.id === over.id) {
      return
    }

    // Within one list it is a plain reorder; across lists the direction decides: an archived card dropped on a board card restores into that card's slot, and a board card dropped among the archived cards simply archives (the archive keeps no meaningful order to aim for).
    if (Boolean(dragged.archived) === Boolean(target.archived)) {
      onReorder?.(dragged.id, target.id)
    } else if (dragged.archived) {
      onRestore?.(dragged.id, target.id, fromKeyboard)
    } else {
      onArchive?.(dragged.id, fromKeyboard)
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setRestorePreview(null)
  }

  return (
    <DndContext
      collisionDetection={boardCollision}
      // The preview moves a card between lists mid-drag, reshaping the board, so droppable rects must be re-measured as the layout changes.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}>
      <EndStrandedKeyboardDrag />
      {children(restorePreview ?? widgets)}
      {activeItem && !activeItem.archived && onArchive ? (
        <ArchiveDropZone />
      ) : null}
      {/* The lifted card follows the cursor in a portal, so it keeps tracking the pointer even over the archive zone and the other list (which sit outside its own sortable context) instead of snapping back to its slot. */}
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <OverlayRow item={activeItem} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
