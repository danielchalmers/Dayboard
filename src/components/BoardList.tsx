import type { ReactNode } from "react"

import { BoardRow } from "~/components/BoardRow"
import type { Widget } from "~/lib/types"

interface BoardListProps {
  items: Widget[]
  now: Date
  compact?: boolean
  renderItemActions?: (item: Widget, index: number) => ReactNode
}

export const BoardList = ({
  items,
  now,
  compact,
  renderItemActions
}: BoardListProps) => {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>Your board is ready</h2>
        <p>Add a clock or countdown and it will appear here.</p>
      </div>
    )
  }

  return (
    <section
      className={compact ? "board-list board-list--compact" : "board-list"}
      aria-label="Clockboard widgets">
      {items.map((item, index) => (
        <BoardRow
          actions={renderItemActions?.(item, index)}
          compact={compact}
          item={item}
          key={item.id}
          now={now}
        />
      ))}
    </section>
  )
}
