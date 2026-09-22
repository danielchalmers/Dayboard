import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from "react"

import {
  formatClockDate,
  formatClockTime,
  formatCountdownTarget,
  formatTimeZoneName,
  getSystemTimeZone,
  getCountdownParts,
  getCountdownPercent,
  getCountdownProgress,
  isKnownTimeZone,
  resolveCountdown
} from "~/lib/time"
import type {
  HabitWidget,
  NoteWidget,
  QuoteWidget,
  StopwatchWidget,
  TimerWidget,
  TodoWidget,
  Widget
} from "~/lib/types"
import { getPresetCssVars } from "~/lib/colors"
import { WidgetIcon } from "~/components/WidgetIcon"
import { playChime, primeChime } from "~/lib/chime"
import {
  formatDayLabel,
  formatWeekRange,
  isDoneOn,
  isDoneToday,
  toDayKey,
  toggleDay,
  weekdayInitials,
  weekDays
} from "~/lib/habit"
import { cleanQuotes, dailyQuoteIndex } from "~/lib/quotes"
import {
  addTask,
  MAX_TASK_LENGTH,
  MAX_TASKS,
  removeTask,
  toggleTask,
  type TodoTask
} from "~/lib/todo"
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

// Auto-save notes a short beat after typing stops to stay well under chrome.storage.sync's write-rate limits while still feeling instant.
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

  // Adopt external updates (another tab, an edit dialog) unless the user is actively typing here, so a remote change never clobbers an in-progress note.
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

  // "open" rotation picks once per tab open; the seed is fixed for the mount so the board's per-second re-render never reshuffles it.
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

  return (
    <blockquote className="quote-text">{quotes[index] ?? quotes[0]}</blockquote>
  )
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
  const { running, durationMs, chime } = item.settings
  const remaining = timerRemainingMs(item.settings, now.getTime())
  const done = remaining <= 0
  const apply = (settings: TimerWidget["settings"]) =>
    onWidgetChange?.({ ...item, settings })

  // Settle the timer the moment it counts down to zero while running, and when this timer opted into a chime, sound it once on that transition.
  useEffect(() => {
    if (running && done) {
      if (chime) {
        playChime()
      }

      onWidgetChange?.({ ...item, settings: finishTimer(item.settings) })
    }
  }, [running, done, item, onWidgetChange, chime])

  const handleStart = () => {
    // Warm up audio from this gesture so the later chime is allowed to sound.
    if (chime) {
      primeChime()
    }

    apply(startTimer(item.settings, Date.now()))
  }

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
      {/* A polite live region announces the finish once (the visible text above is decorative for screen readers).
          It stays mounted and empty until the timer is done so the change is what gets read out. */}
      <span className="sr-only" role="status">
        {done && !running ? `${item.title} timer finished` : ""}
      </span>
      <div className="timer-controls">
        <button
          className="timer-button timer-button--primary"
          onClick={() =>
            running ? apply(pauseTimer(item.settings, Date.now())) : handleStart()
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

const HabitBody = ({
  item,
  now,
  onWidgetChange
}: {
  item: HabitWidget
  now: Date
  onWidgetChange?: (widget: Widget) => void
}) => {
  const { history } = item.settings
  const done = isDoneToday(history, now)
  const week = weekDays(now)
  const todayKey = toDayKey(now)
  // Days that haven't arrived can't be marked, so navigation stops at today.
  const lastMarkable = Math.max(
    week.findIndex((day) => toDayKey(day) === todayKey),
    0
  )
  const dots = useRef<(HTMLButtonElement | null)[]>([])
  // The row is a single tab stop (today, until the arrows move it) rather than seven, which a board of habits would turn into a long walk.
  const [focused, setFocused] = useState<number | null>(null)
  const tabStop = focused ?? lastMarkable

  const toggle = (day: Date) =>
    onWidgetChange?.({
      ...item,
      settings: { history: toggleDay(history, day) }
    })

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, from: number) => {
    const to = {
      ArrowLeft: from - 1,
      ArrowRight: from + 1,
      Home: 0,
      End: lastMarkable
    }[event.key]

    if (to === undefined) {
      return
    }

    event.preventDefault()
    const next = Math.min(Math.max(to, 0), lastMarkable)
    setFocused(next)
    dots.current[next]?.focus()
  }

  return (
    <>
      <div className="habit-week">
        {/* One narrow letter per column.
            The dots carry their own full date, so the headers are decoration for screen readers. */}
        <div className="habit-weekdays" aria-hidden="true">
          {weekdayInitials().map((letter, index) => (
            <span key={index}>{letter}</span>
          ))}
        </div>
        {/* A toolbar rather than a plain group: it tells a screen reader that the arrows walk the row, which is what the roving tab stop does. */}
        <div
          aria-label="This week"
          aria-orientation="horizontal"
          className="habit-days"
          role="toolbar">
          {week.map((day, index) => {
            const key = toDayKey(day)
            const label = formatDayLabel(day)
            // Day keys sort chronologically as strings, so a plain compare tells a day that hasn't arrived from one that has.
            const className = [
              "habit-day",
              isDoneOn(history, day) ? "habit-day--done" : "",
              key === todayKey ? "habit-day--today" : "",
              key > todayKey ? "habit-day--future" : ""
            ]
              .filter(Boolean)
              .join(" ")

            return (
              <button
                aria-label={label}
                aria-pressed={isDoneOn(history, day)}
                className={className}
                disabled={key > todayKey}
                key={key}
                onClick={() => toggle(day)}
                onKeyDown={(event) => moveFocus(event, index)}
                ref={(node) => {
                  dots.current[index] = node
                }}
                tabIndex={index === tabStop ? 0 : -1}
                title={label}
                type="button">
                <span className="habit-day__dot" />
              </button>
            )
          })}
        </div>
      </div>
      {/* The week's dates share the button's line rather than taking one of their own: with the weekday letters above the dots, a card that can't grow has no height left for a third row. */}
      <div className="habit-footer">
        <button
          aria-pressed={done}
          className={`timer-button${done ? "" : " timer-button--primary"}`}
          onClick={() => toggle(now)}
          type="button">
          {done ? "Done today ✓" : "Mark today"}
        </button>
        <p className="board-row__meta">{formatWeekRange(week)}</p>
      </div>
    </>
  )
}

const TodoBody = ({
  item,
  onWidgetChange
}: {
  item: TodoWidget
  onWidgetChange?: (widget: Widget) => void
}) => {
  const [draft, setDraft] = useState("")
  const { tasks } = item.settings
  const isFull = tasks.length >= MAX_TASKS
  const rows = useRef<(HTMLLIElement | null)[]>([])
  const fieldRef = useRef<HTMLInputElement>(null)
  // Where to send focus after the list changes.
  // Removing a task, and adding the one that takes the field away, both unmount the control that had focus; without this the keyboard is dropped on the page body and loses its place on the card.
  const landing = useRef<{ row: number; on: string } | null>(null)

  useEffect(() => {
    const spot = landing.current

    if (!spot) {
      return
    }

    landing.current = null
    // Removing the last task leaves no row to land on, and the field is always back by then, so it is the natural fallback.
    const target = rows.current[spot.row]?.querySelector<HTMLElement>(spot.on)
    ;(target ?? fieldRef.current)?.focus()
  }, [tasks])

  const apply = (nextTasks: TodoTask[]) =>
    onWidgetChange?.({ ...item, settings: { tasks: nextTasks } })

  // The field only clears when a task actually landed, so nothing typed is thrown away by a blank or full add.
  const add = () => {
    const nextTasks = addTask(tasks, draft)

    if (nextTasks !== tasks) {
      // The fourth task takes the field away, so follow it onto the task itself: its box, not its remove button, which is a bad place to leave a keyboard right after typing.
      if (nextTasks.length >= MAX_TASKS) {
        landing.current = {
          row: nextTasks.length - 1,
          on: ".todo-task__box"
        }
      }

      apply(nextTasks)
      setDraft("")
    }
  }

  // Focus follows the list up, the way it does in any other list: the row that takes the removed one's place.
  const remove = (row: number, id: string) => {
    landing.current = { row, on: ".todo-task__remove" }
    apply(removeTask(tasks, id))
  }

  return (
    <>
      <ul className="todo-list">
        {tasks.map((task, row) => (
          <li
            className="todo-task"
            key={task.id}
            ref={(node) => {
              rows.current[row] = node
            }}>
            <label className="todo-task__check">
              <input
                checked={task.done}
                className="todo-task__box"
                onChange={() => apply(toggleTask(tasks, task.id))}
                type="checkbox"
              />
              <span
                className={`todo-task__text${
                  task.done ? " todo-task__text--done" : ""
                }`}>
                {task.text}
              </span>
            </label>
            <button
              aria-label={`Remove ${task.text}`}
              className="todo-task__remove"
              onClick={() => remove(row, task.id)}
              type="button">
              <svg
                aria-hidden="true"
                fill="none"
                height="15"
                viewBox="0 0 24 24"
                width="15">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {/* A full list has nowhere left to type, which says so without a disabled box or a line of copy. */}
      {isFull ? null : (
        // The form is what lets Enter commit the task, including from a phone keyboard's Go key.
        <form
          className="todo-add"
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}>
          <input
            aria-label={`Add a task to ${item.title}`}
            className="todo-add__field"
            maxLength={MAX_TASK_LENGTH}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder="Add a task..."
            ref={fieldRef}
            type="text"
            value={draft}
          />
        </form>
      )}
      {/* The field going away needs explaining to anyone who can't see it go.
          This sits last so the list stays the field's own previous sibling, which the empty-card rule that drops the divider hangs off. */}
      <span className="sr-only" role="status">
        {isFull ? `${item.title} is full — remove a task to add another` : ""}
      </span>
    </>
  )
}

interface CardShellProps {
  item: Widget
  articleProps?: ComponentPropsWithoutRef<"article">
  dragHandleProps?: ComponentPropsWithoutRef<"div">
  className?: string
  style?: CSSProperties
  bodyClassName?: string
  detail?: ReactNode
  children: ReactNode
}

// The shared card frame: a themed article, the drag frame, and the title/detail header.
// Each widget kind supplies only its body (and an optional detail line), so the wrapper lives in one place instead of being repeated per kind.
const CardShell = forwardRef<HTMLElement, CardShellProps>(function CardShell(
  { item, articleProps, dragHandleProps, className, style, bodyClassName, detail, children },
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

  // The frame is an overlay that only covers the padded edge around the content, so dragging starts from the border while the body stays selectable.
  // It only renders when a drag handle is wired up.
  const frame = dragHandleProps ? (
    <div className="board-row__frame" aria-hidden="true" {...dragHandleProps} />
  ) : null

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
          <h2 className="board-row__title">{item.title}</h2>
          {detail !== undefined ? (
            <p className="board-row__detail">{detail}</p>
          ) : null}
        </div>
        {/* A quiet badge in the card's own accent, so a glance tells the kind apart even when two cards share a color. */}
        <span aria-hidden="true" className="board-row__badge">
          <WidgetIcon kind={item.kind} size={18} />
        </span>
      </div>
      <div
        className={`board-row__body${bodyClassName ? ` ${bodyClassName}` : ""}`}>
        {children}
      </div>
    </article>
  )
})

// What a card shows when its body threw while rendering: its own frame and title, so it can still be found, dragged, and edited or deleted from its menu, and the rest of the board carries on around it.
export const BoardRowFallback = forwardRef<HTMLElement, Omit<BoardRowProps, "now" | "onWidgetChange">>(
  function BoardRowFallback(props, ref) {
    return (
      <CardShell {...props} detail="This card couldn’t be shown" ref={ref}>
        {null}
      </CardShell>
    )
  }
)

export const BoardRow = forwardRef<HTMLElement, BoardRowProps>(function BoardRow(
  {
    item,
    now,
    articleProps,
    dragHandleProps,
    className,
    style,
    onWidgetChange
  },
  ref
) {
  const shell = { item, articleProps, dragHandleProps, className, style }

  if (item.kind === "clock") {
    const { timeZone } = item.settings
    // An empty zone follows the system clock, so the card says that rather than naming the zone it happens to be in today.
    // Otherwise the zone is free text, so a card can be saved with a name no browser knows, and the formatters answer that with local time.
    // Say so on the card: the alternative is passing your own time off as somewhere else's, which is worse than a clock that admits it is lost.
    const detail =
      timeZone === ""
        ? "System time zone"
        : !isKnownTimeZone(timeZone)
          ? `${timeZone} — unrecognized, showing your local time`
          : timeZone === getSystemTimeZone()
            ? "Your current time zone"
            : timeZone

    return (
      <CardShell {...shell} detail={detail} ref={ref}>
        <p className="board-row__value" aria-label={`${item.title} time`}>
          {formatClockTime(now, item)}
        </p>
        <p className="board-row__meta">
          {formatClockDate(now, timeZone)}
          <span>{formatTimeZoneName(now, timeZone)}</span>
        </p>
      </CardShell>
    )
  }

  if (item.kind === "note") {
    return (
      <CardShell {...shell} bodyClassName="board-row__body--fill" ref={ref}>
        <NoteField item={item} onWidgetChange={onWidgetChange} />
      </CardShell>
    )
  }

  if (item.kind === "quote") {
    return (
      <CardShell {...shell} bodyClassName="board-row__body--fill" ref={ref}>
        <QuoteField item={item} now={now} />
      </CardShell>
    )
  }

  if (item.kind === "stopwatch") {
    return (
      <CardShell {...shell} ref={ref}>
        <StopwatchBody item={item} now={now} onWidgetChange={onWidgetChange} />
      </CardShell>
    )
  }

  if (item.kind === "timer") {
    return (
      <CardShell {...shell} ref={ref}>
        <TimerBody item={item} now={now} onWidgetChange={onWidgetChange} />
      </CardShell>
    )
  }

  if (item.kind === "habit") {
    return (
      <CardShell {...shell} ref={ref}>
        <HabitBody item={item} now={now} onWidgetChange={onWidgetChange} />
      </CardShell>
    )
  }

  if (item.kind === "todo") {
    // No detail line and no tally: the whole list is on screen, so counting what's done only repeats what the checkboxes already say, and the room that line would take is the room the fourth task needs.
    return (
      <CardShell {...shell} bodyClassName="board-row__body--todo" ref={ref}>
        <TodoBody item={item} onWidgetChange={onWidgetChange} />
      </CardShell>
    )
  }

  const countdownItem = resolveCountdown(item, now)

  const repeatLabel =
    item.settings.repeat && item.settings.repeat !== "none"
      ? ` · repeats ${item.settings.repeat}`
      : ""
  const countdownDetail = `${formatCountdownTarget(countdownItem)}${repeatLabel}`

  const countdown = getCountdownParts(countdownItem, now)

  // A start date is the whole switch: with a span to fill, the card is a bar.
  if (countdownItem.settings.startAt) {
    const percent = getCountdownPercent(getCountdownProgress(countdownItem, now))
    const status =
      percent >= 100 ? "Complete" : countdown.label.replace(/ from now$/, " left")

    return (
      <CardShell {...shell} detail={countdownDetail} ref={ref}>
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
            style={{ transform: `translateX(${percent - 100}%)` }}
          />
        </div>
        <p className="board-row__meta">{status}</p>
      </CardShell>
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
    <CardShell {...shell} detail={countdownDetail} ref={ref}>
      <p className="board-row__value board-row__value--countdown">{value}</p>
      {context ? <p className="board-row__meta">{context}</p> : null}
    </CardShell>
  )
})
