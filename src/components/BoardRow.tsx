import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties
} from "react"

import {
  formatClockDate,
  formatClockTime,
  formatCountdownTarget,
  formatTimeZoneName,
  getCountdownParts,
  getCountdownProgress
} from "~/lib/time"
import type {
  NoteWidget,
  QuoteWidget,
  StopwatchWidget,
  TimerWidget,
  Widget
} from "~/lib/types"
import { getPresetCssVars } from "~/lib/colors"
import { cleanQuotes, dailyQuoteIndex } from "~/lib/quotes"
import {
  finishTimer,
  formatDuration,
  pauseStopwatch,
  pauseTimer,
  resetStopwatch,
  resetTimer,
  startStopwatch,
  startTimer,
  stopwatchElapsedMs,
  timerRemainingMs
} from "~/lib/timers"

interface BoardRowProps {
  item: Widget
  now: Date
  articleProps?: ComponentPropsWithoutRef<"article">
  dragHandleProps?: ComponentPropsWithoutRef<"div">
  className?: string
  style?: CSSProperties
  onWidgetChange?: (widget: Widget) => void
}

// Auto-save notes a short beat after typing stops to stay well under
// chrome.storage.sync's write-rate limits while still feeling instant.
const NOTE_SAVE_DELAY = 600

const NoteField = ({
  item,
  onWidgetChange
}: {
  item: NoteWidget
  onWidgetChange?: (widget: Widget) => void
}) => {
  const [text, setText] = useState(item.settings.text)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<number | undefined>(undefined)

  // Keep the latest callback without re-running the save timers.
  const onChangeRef = useRef(onWidgetChange)
  onChangeRef.current = onWidgetChange

  // Adopt external updates (another tab, an edit dialog) unless the user is
  // actively typing here, so a remote change never clobbers an in-progress note.
  useEffect(() => {
    if (document.activeElement === fieldRef.current) {
      return
    }

    setText(item.settings.text)
  }, [item.settings.text])

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    },
    []
  )

  const save = (value: string) => {
    if (value !== item.settings.text) {
      onChangeRef.current?.({ ...item, settings: { text: value } })
    }
  }

  const handleChange = (value: string) => {
    setText(value)

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => save(value), NOTE_SAVE_DELAY)
  }

  const flush = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = undefined
    }

    save(text)
  }

  return (
    <textarea
      aria-label={`${item.title} note`}
      className="note-field"
      onBlur={flush}
      onChange={(event) => handleChange(event.currentTarget.value)}
      placeholder="Jot something down..."
      ref={fieldRef}
      spellCheck={false}
      value={text}
    />
  )
}

const QuoteField = ({ item, now }: { item: QuoteWidget; now: Date }) => {
  const quotes = cleanQuotes(item.settings.quotes)

  // "open" rotation picks once per tab open; the seed is fixed for the mount so
  // the board's per-second re-render never reshuffles it.
  const [openSeed] = useState(() => Math.random())

  if (quotes.length === 0) {
    return (
      <p className="quote-text quote-text--empty">
        Add a few quotes to this widget to get started.
      </p>
    )
  }

  const index =
    item.settings.rotation === "daily"
      ? dailyQuoteIndex(now, quotes.length)
      : Math.floor(openSeed * quotes.length) % quotes.length

  return <blockquote className="quote-text">{quotes[index] ?? quotes[0]}</blockquote>
}

const StopwatchBody = ({
  item,
  now,
  onWidgetChange
}: {
  item: StopwatchWidget
  now: Date
  onWidgetChange?: (widget: Widget) => void
}) => {
  const elapsed = stopwatchElapsedMs(item.settings, now.getTime())
  const { running } = item.settings
  const apply = (settings: StopwatchWidget["settings"]) =>
    onWidgetChange?.({ ...item, settings })

  return (
    <>
      <p className="board-row__value board-row__value--timer">
        {formatDuration(elapsed)}
      </p>
      <div className="timer-controls">
        <button
          className="timer-button timer-button--primary"
          onClick={() =>
            apply(
              running
                ? pauseStopwatch(item.settings, Date.now())
                : startStopwatch(item.settings, Date.now())
            )
          }
          type="button">
          {running ? "Pause" : "Start"}
        </button>
        <button
          className="timer-button"
          disabled={!running && elapsed === 0}
          onClick={() => apply(resetStopwatch())}
          type="button">
          Reset
        </button>
      </div>
    </>
  )
}

const TimerBody = ({
  item,
  now,
  onWidgetChange
}: {
  item: TimerWidget
  now: Date
  onWidgetChange?: (widget: Widget) => void
}) => {
  const { running, durationMs } = item.settings
  const remaining = timerRemainingMs(item.settings, now.getTime())
  const done = remaining <= 0
  const apply = (settings: TimerWidget["settings"]) =>
    onWidgetChange?.({ ...item, settings })

  // Settle the timer the moment it counts down to zero while running.
  useEffect(() => {
    if (running && done) {
      onWidgetChange?.({ ...item, settings: finishTimer(item.settings) })
    }
  }, [running, done, item, onWidgetChange])

  const primaryLabel = running
    ? "Pause"
    : remaining > 0 && remaining < durationMs
      ? "Resume"
      : "Start"

  return (
    <>
      <p
        className={`board-row__value board-row__value--timer${
          done && !running ? " board-row__value--timer-done" : ""
        }`}>
        {formatDuration(remaining)}
      </p>
      {done && !running ? (
        <p className="board-row__meta board-row__meta--alert">Time&rsquo;s up</p>
      ) : null}
      <div className="timer-controls">
        <button
          className="timer-button timer-button--primary"
          onClick={() =>
            apply(
              running
                ? pauseTimer(item.settings, Date.now())
                : startTimer(item.settings, Date.now())
            )
          }
          type="button">
          {primaryLabel}
        </button>
        <button
          className="timer-button"
          disabled={!running && remaining === durationMs}
          onClick={() => apply(resetTimer(item.settings))}
          type="button">
          Reset
        </button>
      </div>
    </>
  )
}

export const BoardRow = forwardRef<HTMLElement, BoardRowProps>(function BoardRow(
  { item, now, articleProps, dragHandleProps, className, style, onWidgetChange },
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

  if (item.kind === "note") {
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
          </div>
        </div>
        <div className="board-row__body board-row__body--fill">
          <NoteField item={item} onWidgetChange={onWidgetChange} />
        </div>
      </article>
    )
  }

  if (item.kind === "quote") {
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
          </div>
        </div>
        <div className="board-row__body board-row__body--fill">
          <QuoteField item={item} now={now} />
        </div>
      </article>
    )
  }

  if (item.kind === "stopwatch" || item.kind === "timer") {
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
          </div>
        </div>
        <div className="board-row__body">
          {item.kind === "stopwatch" ? (
            <StopwatchBody item={item} now={now} onWidgetChange={onWidgetChange} />
          ) : (
            <TimerBody item={item} now={now} onWidgetChange={onWidgetChange} />
          )}
        </div>
      </article>
    )
  }

  const countdown = getCountdownParts(item, now)

  if (item.settings.display === "progress") {
    const fraction = getCountdownProgress(item, now)
    const percent = Math.round(fraction * 100)
    const status =
      fraction >= 1
        ? "Complete"
        : countdown.label.replace(/ from now$/, " left")

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
            {percent}%
          </p>
          <div
            className="progress-bar"
            role="progressbar"
            aria-label={`${item.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}>
            <div
              className="progress-bar__fill"
              style={{ inlineSize: `${percent}%` }}
            />
          </div>
          <p className="board-row__meta">{status}</p>
        </div>
      </article>
    )
  }

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
