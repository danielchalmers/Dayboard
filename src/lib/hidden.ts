// Whether the board is hidden on this device: a cover for a screen someone else can see, not a lock.
//
// It is kept in localStorage rather than with the board in chrome.storage.sync for two reasons.
// Hiding is about where this screen is, so it should not follow the board to another signed-in browser; and localStorage reads synchronously, so a new tab opened while the board is hidden never paints the cards first.
export const HIDDEN_KEY = "dayboard-hidden"

export const readBoardHidden = (): boolean => {
  try {
    return localStorage.getItem(HIDDEN_KEY) === "1"
  } catch {
    return false
  }
}

export const writeBoardHidden = (hidden: boolean) => {
  try {
    if (hidden) {
      localStorage.setItem(HIDDEN_KEY, "1")
    } else {
      localStorage.removeItem(HIDDEN_KEY)
    }
  } catch {
    // Best effort: without localStorage this tab still hides, it just can't tell the next one.
  }
}

// The other board tabs open on this device hide and show together, so a board hidden in one window is not still on show in the next.
// The storage event only reaches the tabs that did not make the change, and a cleared localStorage reports no key at all.
export const watchBoardHidden = (
  listener: (hidden: boolean) => void
): (() => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === HIDDEN_KEY || event.key === null) {
      listener(readBoardHidden())
    }
  }

  window.addEventListener("storage", handleStorage)

  return () => window.removeEventListener("storage", handleStorage)
}
