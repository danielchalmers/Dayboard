import type { ReactNode } from "react"

import { BoardRow } from "~/components/BoardRow"
import type { BoardItem, ClockboardSettings } from "~/lib/types"

interface BoardListProps {
  items: BoardItem[]
  now: Date
  settings: ClockboardSettings
  compact?: boolean
  renderItemActions?: (item: BoardItem, index: number) => ReactNode
}

export const BoardList = ({
  items,
  now,
  settings,
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
      aria-label="Clockboard items">
      {items.map((item, index) => (
        <BoardRow
          actions={renderItemActions?.(item, index)}
          compact={compact}
          item={item}
          key={item.id}
          now={now}
          settings={settings}
        />
      ))}
    </section>
  )
}
