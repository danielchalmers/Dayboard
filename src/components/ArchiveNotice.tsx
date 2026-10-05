import { useEffect, useRef, useState, type MouseEventHandler } from "react"

// Long enough to read the line and reach for Undo, short enough that the notice is gone before it becomes part of the page.
export const ARCHIVE_NOTICE_MS = 6000

interface ArchiveNoticeProps {
  title: string
  onUndo: MouseEventHandler<HTMLButtonElement>
  onExpire: () => void
}

// An archived card leaves the board in a blink, and with nothing to say where it went, an archive made by a stray drag or a slip in the menu looked like the card was simply gone.
// So the notice names the card and offers the way straight back.
// It lets itself go after a few seconds, but never out from under a pointer resting on it or a keyboard that has reached its button.
export const ArchiveNotice = ({ title, onUndo, onExpire }: ArchiveNoticeProps) => {
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

  return (
    <div
      className="board-notice board-notice--quiet"
      onBlur={() => setHasFocus(false)}
      onFocus={() => setHasFocus(true)}
      onPointerEnter={() => setHasPointer(true)}
      onPointerLeave={() => setHasPointer(false)}>
      {/* Set apart from the line around it, so a title written right to left keeps its own punctuation at its own end. */}
      <span className="board-notice__text board-notice__text--one-line">
        Archived <bdi>{title}</bdi>
      </span>
      <button
        className="board-notice__action"
        onClick={onUndo}
        type="button">
        Undo
      </button>
    </div>
  )
}
