import { useEffect, useRef, useState, type MouseEventHandler } from "react"

// Long enough to read the line and reach for Undo, short enough that the notice is gone before it becomes part of the page.
export const ARCHIVE_NOTICE_MS = 6000

interface ArchiveNoticeProps {
  title: string
  onUndo: MouseEventHandler<HTMLButtonElement>
  // Undo asked for with Ctrl+Z or Cmd+Z rather than from the button.
  onUndoShortcut: () => void
  onExpire: () => void
}

const isUndoKey = (event: KeyboardEvent): boolean =>
  (event.ctrlKey || event.metaKey) &&
  !event.shiftKey &&
  !event.altKey &&
  event.key.toLowerCase() === "z"

// A field has an undo of its own, which the key belongs to while the caret is in it, and a dialog open over the board is not the place to change the board from.
const isElsewhere = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest("input, textarea, select, [contenteditable], dialog") !== null

// An archived card leaves the board in a blink, and with nothing to say where it went, an archive made by a stray drag or a slip in the menu looked like the card was simply gone.
// So the notice names the card and offers the way straight back.
// It lets itself go after a few seconds, but never out from under a pointer resting on it or a keyboard that has reached its button.
export const ArchiveNotice = ({ title, onUndo, onUndoShortcut, onExpire }: ArchiveNoticeProps) => {
  const noticeRef = useRef<HTMLDivElement>(null)
  const [hasPointer, setHasPointer] = useState(false)
  const [hasFocus, setHasFocus] = useState(false)
  const isHeld = hasPointer || hasFocus

  // The page hands over a fresh callback whenever it renders, which must not restart the countdown.
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (isHeld) {
      return
    }

    const timeout = window.setTimeout(() => onExpireRef.current(), ARCHIVE_NOTICE_MS)
    return () => window.clearTimeout(timeout)
  }, [isHeld])

  // An archive from the keyboard leaves focus on the next card, and Tab reaches the button only after every card on the board, which the notice does not wait for.
  // So the key that already means undo works for as long as the notice is showing, and no longer: not while a refused save has its place, and not while a drag has it stepped aside.
  const onUndoShortcutRef = useRef(onUndoShortcut)
  onUndoShortcutRef.current = onUndoShortcut

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !isUndoKey(event) ||
        event.defaultPrevented ||
        event.repeat ||
        isElsewhere(event.target)
      ) {
        return
      }

      if (!noticeRef.current?.checkVisibility({ visibilityProperty: true })) {
        return
      }

      event.preventDefault()
      onUndoShortcutRef.current()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div
      className="board-notice board-notice--quiet"
      ref={noticeRef}
      onBlur={() => setHasFocus(false)}
      onFocus={() => setHasFocus(true)}
      onPointerEnter={() => setHasPointer(true)}
      onPointerLeave={() => setHasPointer(false)}
    >
      {/* Set apart from the line around it, so a title written right to left keeps its own punctuation at its own end. */}
      <span className="board-notice__text board-notice__text--one-line">
        Archived <bdi>{title}</bdi>
      </span>
      <button
        aria-keyshortcuts="Control+Z Meta+Z"
        className="board-notice__action"
        onClick={onUndo}
        type="button"
      >
        Undo
      </button>
    </div>
  )
}
