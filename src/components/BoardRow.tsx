import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type CSSProperties
} from "react"

import {
  formatClockDate,
  formatClockTime,
  formatCountdownTarget,
  formatTimeZoneName,
  getCountdownParts
} from "~/lib/time"
import type { Widget } from "~/lib/types"
import { getPresetCssVars } from "~/lib/colors"

interface BoardRowProps {
  item: Widget
  now: Date
  articleProps?: ComponentPropsWithoutRef<"article">
  dragHandleProps?: ComponentPropsWithoutRef<"div">
  className?: string
  style?: CSSProperties
}

export const BoardRow = forwardRef<HTMLElement, BoardRowProps>(function BoardRow(
  { item, now, articleProps, dragHandleProps, className, style },
  ref
) {
  const rowClassName = [
    "board-row",
    `board-row--theme-${item.colorPreset}`,
    className
  ]
    .filter(Boolean)
    .join(" ")

  const combinedStyle = {
    ...style,
    ...getPresetCssVars(item.colorPreset)
  }

  // The frame is an overlay that only covers the padded edge around the
  // content, so dragging starts from the border while the body stays
  // selectable. It only renders when a drag handle is wired up.
  const frame = dragHandleProps ? (
    <div className="board-row__frame" aria-hidden="true" {...dragHandleProps} />
  ) : null

  const colorDot = item.colorPreset !== "slate" ? (
    <span
      className={`board-row__color-dot board-row__color-dot--${item.colorPreset}`}
      aria-hidden="true"
    />
  ) : null

  if (item.kind === "clock") {
    const detail =
      item.settings.timeZone === Intl.DateTimeFormat().resolvedOptions().timeZone
        ? "Your current time zone"
        : item.settings.timeZone

    return (
      <article
        {...articleProps}
        className={rowClassName}
        ref={ref}
        style={combinedStyle}
        data-color-preset={item.colorPreset}>
        {frame}
        <div className="board-row__header">
          <div className="board-row__identity">
            <h2 className="board-row__title">
              {colorDot}
              {item.title}
            </h2>
            <p className="board-row__detail">{detail}</p>
          </div>
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
    <article
      {...articleProps}
      className={rowClassName}
      ref={ref}
      style={combinedStyle}
      data-color-preset={item.colorPreset}>
      {frame}
      <div className="board-row__header">
        <div className="board-row__identity">
          <h2 className="board-row__title">
            {colorDot}
            {item.title}
          </h2>
          <p className="board-row__detail">{formatCountdownTarget(item)}</p>
        </div>
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
