import { forwardRef, type CSSProperties, type ReactNode } from "react"

import {
  formatClockDate,
  formatClockTime,
  formatCountdownTarget,
  formatTimeZoneName,
  getCountdownParts
} from "~/lib/time"
import type { Widget } from "~/lib/types"

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
    const detail =
      item.settings.timeZone === Intl.DateTimeFormat().resolvedOptions().timeZone
        ? "Your current time zone"
        : item.settings.timeZone

    return (
      <article className={rowClassName} ref={ref} style={style}>
        <div className="board-row__header">
          <div className="board-row__identity">
            <h2>{item.title}</h2>
            <p className="board-row__detail">{detail}</p>
          </div>
          {actions ? <div className="board-row__actions">{actions}</div> : null}
        </div>
        <div className="board-row__body">
          <p className="board-row__value" aria-label={`${item.title} time`}>
            {formatClockTime(now, item)}
          </p>
          <p className="board-row__meta">
            {formatClockDate(now, item.settings.timeZone)}
            <span>{formatTimeZoneName(now, item.settings.timeZone)}</span>
          </p>
        </div>
      </article>
    )
  }

  const countdown = getCountdownParts(item, now)
  const value =
    countdown.status === "due"
      ? "right now"
      : countdown.label.replace(/ (from now|ago)$/, "")
  const context =
    countdown.status === "due"
      ? ""
      : countdown.label.endsWith("ago")
        ? "ago"
        : "from now"

  return (
    <article className={rowClassName} ref={ref} style={style}>
      <div className="board-row__header">
        <div className="board-row__identity">
          <h2>{item.title}</h2>
          <p className="board-row__detail">{formatCountdownTarget(item)}</p>
        </div>
        {actions ? <div className="board-row__actions">{actions}</div> : null}
      </div>
      <div className="board-row__body">
        <p className="board-row__value board-row__value--countdown">
          {value}
        </p>
        {context ? <p className="board-row__meta">{context}</p> : null}
      </div>
    </article>
  )
})
