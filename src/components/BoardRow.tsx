import type { ReactNode } from "react"

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
  actions?: ReactNode
}

export const BoardRow = ({
  item,
  now,
  settings,
  compact = false,
  actions
}: BoardRowProps) => {
  if (item.kind === "clock") {
    return (
      <article className={compact ? "board-row board-row--compact" : "board-row"}>
        <div className="board-row__identity">
          <span className="board-row__mark" aria-hidden="true" />
          <div>
            <p className="board-row__kind">Clock</p>
            <h2>{item.title}</h2>
            <p className="board-row__detail">
              {item.timeZone} · {formatTimeZoneName(now, item.timeZone)}
              {settings.showDate
                ? ` · ${formatClockDate(now, item.timeZone)}`
                : ""}
            </p>
          </div>
        </div>
        <div className="board-row__side">
          <p className="board-row__value" aria-label={`${item.title} time`}>
            {formatClockTime(now, item)}
          </p>
          {actions ? <div className="board-row__actions">{actions}</div> : null}
        </div>
      </article>
    )
  }

  const countdown = getCountdownParts(item, now)

  return (
    <article className={compact ? "board-row board-row--compact" : "board-row"}>
      <div className="board-row__identity">
        <span className="board-row__mark" aria-hidden="true" />
        <div>
          <p className="board-row__kind">Countdown</p>
          <h2>{item.title}</h2>
          <p className="board-row__detail">
            {formatCountdownTarget(item)} · {item.timeZone} ·{" "}
            {formatTimeZoneName(now, item.timeZone)}
          </p>
        </div>
      </div>
      <div className="board-row__side">
        <p className="board-row__value board-row__value--countdown">
          {countdown.status === "due" ? "right now" : countdown.label}
        </p>
        {actions ? <div className="board-row__actions">{actions}</div> : null}
      </div>
    </article>
  )
}
