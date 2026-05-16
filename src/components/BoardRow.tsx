import { forwardRef, type CSSProperties, type ReactNode } from "react"

import {
  formatClockDate,
  formatClockTime,
  formatCountdownTarget,
  formatTimeZoneName,
  getCountdownParts
} from "~/lib/time"
import type { Widget } from "~/lib/types"
import { widgetRegistry } from "~/lib/widgets"

interface BoardRowProps {
  item: Widget
  now: Date
  compact?: boolean
  actions?: ReactNode
  className?: string
  style?: CSSProperties
}

export const BoardRow = forwardRef<HTMLElement, BoardRowProps>(function BoardRow(
  { item, now, compact = false, actions, className, style },
  ref
) {
  const rowClassName = [
    compact ? "board-row board-row--compact" : "board-row",
    className
  ]
    .filter(Boolean)
    .join(" ")

  if (item.kind === "clock") {
    return (
      <article className={rowClassName} ref={ref} style={style}>
        <div className="board-row__identity">
          <span className="board-row__mark" aria-hidden="true" />
          <div>
            <p className="board-row__kind">{widgetRegistry.clock.kindLabel}</p>
            <h2>{item.title}</h2>
            <p className="board-row__detail">
              {formatTimeZoneName(now, item.settings.timeZone)} ·{" "}
              {formatClockDate(now, item.settings.timeZone)}
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
    <article className={rowClassName} ref={ref} style={style}>
      <div className="board-row__identity">
        <span className="board-row__mark" aria-hidden="true" />
        <div>
          <p className="board-row__kind">{widgetRegistry.countdown.kindLabel}</p>
          <h2>{item.title}</h2>
          <p className="board-row__detail">{formatCountdownTarget(item)}</p>
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
})
