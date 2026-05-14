import { BoardRow } from "~/components/BoardRow"
import type { BoardItem, ClockboardSettings } from "~/lib/types"

interface BoardListProps {
  items: BoardItem[]
  now: Date
  settings: ClockboardSettings
  compact?: boolean
}

export const BoardList = ({ items, now, settings, compact }: BoardListProps) => {
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
      {items.map((item) => (
        <BoardRow
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
