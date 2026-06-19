import { useEffect, useRef, type RefObject } from "react"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(", ")

// Make a modal dialog keyboard-correct: move focus into it on open, trap Tab so
// focus cannot escape to the page behind the backdrop, close on Escape, and
// restore focus to whatever opened it when it closes.
export const useModalFocus = (
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void
) => {
  // onClose is often recreated each render; keep the latest without re-running
  // the effect (which would steal focus back to the top on every render).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const container = containerRef.current

    if (!isOpen || !container) {
      return
    }

    const opener = document.activeElement as HTMLElement | null
    const getFocusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        // Skip hidden controls (e.g. the Options dialog's hidden file input).
        (el) => el.getClientRects().length > 0 || el === document.activeElement
      )

    // Move focus inside without scrolling the page.
    ;(getFocusable()[0] ?? container).focus({ preventScroll: true })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== "Tab") {
        return
      }

      const items = getFocusable()

      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement

      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener("keydown", handleKeyDown)

    return () => {
      container.removeEventListener("keydown", handleKeyDown)

      // Return focus to the opener if it is still in the document.
      if (opener && document.contains(opener) && typeof opener.focus === "function") {
        opener.focus({ preventScroll: true })
      }
    }
  }, [isOpen, containerRef])
}
