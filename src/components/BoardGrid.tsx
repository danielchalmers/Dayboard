import { BoardTile } from "~/components/BoardTile"
import type { BoardItem, ClockboardSettings } from "~/lib/types"

interface BoardGridProps {
  items: BoardItem[]
  now: Date
  settings: ClockboardSettings
  compact?: boolean
}

export const BoardGrid = ({ items, now, settings, compact }: BoardGridProps) => {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>No clocks yet</h2>
        <p>Open options to add a clock or countdown to your board.</p>
      </div>
    )
  }

  return (
    <section
      className={
        settings.density === "compact" || compact
          ? "board-grid board-grid--compact"
          : "board-grid"
      }
      aria-label="Clockboard items">
      {items.map((item) => (
        <BoardTile
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
