import {
  formatClockDate,
  formatClockTime,
  formatCountdownTarget,
  formatTimeZoneName,
  getCountdownParts
} from "~/lib/time"
import type { BoardItem, ClockboardSettings } from "~/lib/types"

interface BoardTileProps {
  item: BoardItem
  now: Date
  settings: ClockboardSettings
  compact?: boolean
}

export const BoardTile = ({
  item,
  now,
  settings,
  compact = false
}: BoardTileProps) => {
  const style = {
    "--item-color": item.color
  } as React.CSSProperties

  if (item.kind === "clock") {
    return (
      <article className="tile" style={style}>
        <div className="tile__meta">
          <span className="tile__kind">Clock</span>
          <span>{formatTimeZoneName(now, item.timeZone)}</span>
        </div>
        <h2 className="tile__title">{item.title}</h2>
        <p className={compact ? "tile__value tile__value--small" : "tile__value"}>
          {formatClockTime(now, item)}
        </p>
        {settings.showDate ? (
          <p className="tile__subtle">{formatClockDate(now, item.timeZone)}</p>
        ) : null}
      </article>
    )
  }

  const countdown = getCountdownParts(item, now)

  return (
    <article className="tile" style={style}>
      <div className="tile__meta">
        <span className="tile__kind">Countdown</span>
        <span>{formatTimeZoneName(now, item.timeZone)}</span>
      </div>
      <h2 className="tile__title">{item.title}</h2>
      <p
        className={
          compact ? "tile__value tile__value--small" : "tile__value"
        }>
        {countdown.status === "due" ? "Now" : countdown.label}
      </p>
      <p className="tile__subtle">{formatCountdownTarget(item)}</p>
    </article>
  )
}
