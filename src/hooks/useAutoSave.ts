import { useEffect, useRef, useState, type RefObject } from "react"

// Typed text saves a short beat after typing stops, to stay well under chrome.storage.sync's write-rate limits while still feeling instant.
export const AUTO_SAVE_DELAY = 600

// Hands the typed text up and may hear back why storage refused it (null once it is saved).
// `isShown` says whether the field is still on screen to keep the words if storage refuses them, asked when the answer comes back, since a save sent as the field goes (or just before) answers after it has gone.
type Save = (value: string, isShown: () => boolean) => Promise<string | null> | void

interface AutoSaveOptions {
  // Take a change made elsewhere while the field has focus, so long as nothing is typed in it.
  adoptWhileFocused?: boolean
}

interface AutoSaveField<E extends HTMLElement> {
  fieldRef: RefObject<E | null>
  value: string
  onChange: (value: string) => void
  onBlur: () => void
}

// A field typed straight into the page, a note or the greeting name, saving itself as it goes.
// `stored` is what storage holds for it and `save` hands typed text up; both are read as they are when a save runs, not as they were at the keystroke that scheduled it.
export const useAutoSave = <E extends HTMLElement>(
  stored: string,
  save: Save,
  { adoptWhileFocused = false }: AutoSaveOptions = {}
): AutoSaveField<E> => {
  const [text, setText] = useState(stored)
  const fieldRef = useRef<E>(null)
  const timerRef = useRef<number | undefined>(undefined)
  // Typing storage doesn't hold yet, or null once it does.
  // It stays set while its save is on the way and after storage refuses it, so the field never trades the user's words for the stored text until those words have landed.
  const pendingRef = useRef<string | null>(null)
  // The text a save is carrying right now, so a blur or a hidden page in the meantime doesn't send the same words twice.
  const savingRef = useRef<string | null>(null)
  // Set as the field unmounts, after which nothing on screen holds its words.
  const goneRef = useRef(false)

  // Keep the latest callback and stored text without re-running the save timers.
  // The save runs a beat after the keystroke that scheduled it, and building it from that keystroke's render would write back whatever the board looked like then, undoing an archive or rename that landed in between.
  const saveRef = useRef(save)
  saveRef.current = save
  const storedRef = useRef(stored)
  storedRef.current = stored

  // Adopt external updates (another tab, an edit dialog) unless the user is actively typing here or has words here storage doesn't hold yet, so a remote change, or the rollback of a refused save, never clobbers them.
  const adoptRef = useRef(() => {
    const isTypingHere = !adoptWhileFocused && document.activeElement === fieldRef.current

    if (!isTypingHere && pendingRef.current === null) {
      setText(storedRef.current)
    }
  })

  useEffect(() => {
    adoptRef.current()
  }, [stored])

  const flushRef = useRef(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = undefined
    }

    const value = pendingRef.current

    if (value === null || value === savingRef.current) {
      return
    }

    // Text typed back to exactly what is stored goes up too: nothing is written for it, but that is how the notice for refused words hears there are none left here.
    savingRef.current = value
    void Promise.resolve(saveRef.current(value, () => !goneRef.current)).then((refused) => {
      if (savingRef.current === value) {
        savingRef.current = null
      }

      // A refused save keeps its words pending, so the next blur, pause, or hidden page tries them again and the notice tells the user what to change; typed on since, the newer words have a save of their own coming.
      if (!refused && pendingRef.current === value) {
        pendingRef.current = null
        // Anything that arrived from elsewhere while these words were on their way was held back above, so catch up with it now.
        adoptRef.current()
      }
    })
  })

  // Closing the tab straight after typing neither blurs the field nor unmounts it, so the pending save would die with the page; hand it over the moment the page is hidden, which comes before it goes.
  // Unmounting (a note archived out of view, Options closing) flushes too, rather than dropping the last few keystrokes.
  useEffect(() => {
    const flush = flushRef.current
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flush()
      }
    }

    document.addEventListener("visibilitychange", flushWhenHidden)
    window.addEventListener("pagehide", flush)

    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden)
      window.removeEventListener("pagehide", flush)
      goneRef.current = true
      flush()
    }
  }, [])

  // Leaving the field hands over what was typed, or, with nothing typed, catches up on any change that arrived while it was focused and so was held back above.
  const onBlur = () => {
    if (pendingRef.current !== null) {
      flushRef.current()
    } else {
      setText(storedRef.current)
    }
  }

  const onChange = (value: string) => {
    setText(value)
    pendingRef.current = value

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(flushRef.current, AUTO_SAVE_DELAY)
  }

  return { fieldRef, value: text, onChange, onBlur }
}
