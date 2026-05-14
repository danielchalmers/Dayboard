import {
  formatClockDate,
  formatClockTime,
  formatCountdownTarget,
  formatTimeZoneName,
  getCountdownParts
} from "~/lib/time"
import type { BoardItem, ClockboardSettings } from "~/lib/types"

interface BoardRowProps {
  item: BoardItem
  now: Date
  settings: ClockboardSettings
  compact?: boolean
}

export const BoardRow = ({
  item,
  now,
  settings,
  compact = false
}: BoardRowProps) => {
  const rowClassName = compact ? "board-row board-row--compact" : "board-row"

  if (item.kind === "clock") {
    const details = [
      settings.detailLevel === "minimal" ? null : item.timeZone,
      formatTimeZoneName(now, item.timeZone),
      settings.showDate && settings.detailLevel !== "minimal"
        ? formatClockDate(now, item.timeZone)
        : null
    ].filter(Boolean)

    return (
      <article className={rowClassName}>
        <div className="board-row__identity">
          <div className="board-row__meta">
            <span className="board-row__kind">Clock</span>
            <h2>{item.title}</h2>
            {details.length > 0 ? (
              <p className="board-row__detail">{details.join(" / ")}</p>
            ) : null}
          </div>
        </div>
        <div className="board-row__readout">
          <p className="board-row__value" aria-label={`${item.title} time`}>
            {formatClockTime(now, item, settings.clockPrecision)}
          </p>
        </div>
      </article>
    )
  }

  const countdown = getCountdownParts(item, now)
  const details = [
    formatCountdownTarget(item),
    settings.detailLevel === "rich" ? item.timeZone : null,
    settings.detailLevel !== "minimal" ? formatTimeZoneName(now, item.timeZone) : null
  ].filter(Boolean)

  return (
    <article className={rowClassName}>
      <div className="board-row__identity">
        <div className="board-row__meta">
          <span className="board-row__kind">Countdown</span>
          <h2>{item.title}</h2>
          {details.length > 0 ? (
            <p className="board-row__detail">{details.join(" / ")}</p>
          ) : null}
        </div>
      </div>
      <div className="board-row__readout">
        <p className="board-row__value board-row__value--countdown">
          {countdown.status === "due" ? "right now" : countdown.label}
        </p>
        {settings.detailLevel === "rich" && countdown.status === "past" ? (
          <p className="board-row__subvalue">Elapsed</p>
        ) : null}
      </div>
    </article>
  )
}
