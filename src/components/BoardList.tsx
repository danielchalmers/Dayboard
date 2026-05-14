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
        <p>Add a clock or countdown to compose the first view.</p>
      </div>
    )
  }

  const className = [
    "board-list",
    compact ? "board-list--compact" : null,
    compact ? null : `board-list--${settings.layout}`,
    compact ? null : `board-list--${settings.density}`
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <section
      className={className}
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
