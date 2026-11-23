import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react"

import { isKnownTimeZone } from "~/lib/time"
import { listTimeZones, searchTimeZones, type ZoneOption } from "~/lib/zoneSearch"

interface TimeZoneFieldProps {
  value: string
  onChange: (timeZone: string) => void
}

// The open list is shown as a popover, which puts it in the browser's top layer, anchored to the field by the stylesheet.
// Laid out inside the dialog it belonged to the dialog's scroll area: opening it scrolled the title and the Save row out of sight and cut the list off at the dialog's bottom edge.
// In the top layer it floats over the dialog the way a native select's list does, and flips above the field when there is no room below.
// "manual" leaves opening and closing to the field, which already closes on blur, Escape and a choice.
// The optional call keeps jsdom (which has no popovers) out of trouble in tests.
const showInTopLayer = (node: HTMLDivElement | null) => {
  try {
    node?.showPopover?.()
  } catch {
    // Already shown, so ignore.
  }
}

// A combobox over the full IANA list rather than an input with a datalist: the native list only offers entries matching the current value,
// so a clock already set to one zone never showed the others. Clicking here always opens the whole list; typing is what narrows it.
// Typing searches more than the names in the list (see `searchTimeZones`), but what the field ends up holding is always one of those names.
export const TimeZoneField = ({ value, onChange }: TimeZoneFieldProps) => {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  // Open state carries whether the user is narrowing by typing; opened by click, the list ignores the current value and shows everything.
  const [popup, setPopup] = useState<{ filtering: boolean } | null>(null)
  const [highlighted, setHighlighted] = useState(0)
  // Set by real keystrokes just before their input event, which is how typing is told apart from a programmatic value change; the latter must not pop the list.
  const typingRef = useRef(false)

  const isFiltering = popup?.filtering === true
  const visible = useMemo(
    () => (isFiltering ? searchTimeZones(value) : listTimeZones()),
    [isFiltering, value]
  )

  const openAll = () => {
    const current = listTimeZones().findIndex((option) => option.value === value)

    setPopup({ filtering: false })
    setHighlighted(Math.max(current, 0))
  }

  const choose = (option: ZoneOption) => {
    onChange(option.value)
    setPopup(null)
  }

  // The box takes typing so the list can be searched, which also let a card be saved on whatever was typed: "San Francisco" made a clock that showed local time and said it was lost.
  // Marking anything the browser can't keep time for invalid lets native validation hold the save, the same as an empty required field.
  // The test is the browser's, not the list's, so a name it knows but doesn't list (US/Pacific, Etc/GMT+5) still saves when typed out.
  const isUnknown = value !== "" && !isKnownTimeZone(value)
  useEffect(() => {
    inputRef.current?.setCustomValidity(isUnknown ? "Pick a time zone from the list." : "")
  }, [isUnknown])

  // Keep the highlighted option in view as the highlight moves and when the list first opens on the current zone.
  // The optional call keeps jsdom (which has no scrollIntoView) out of trouble in tests.
  useEffect(() => {
    if (popup) {
      document.getElementById(`${id}-option-${highlighted}`)?.scrollIntoView?.({ block: "nearest" })
    }
  }, [popup, highlighted, id])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()

      if (!popup) {
        openAll()
        return
      }

      const step = event.key === "ArrowDown" ? 1 : -1
      setHighlighted((current) => (current + step + visible.length) % Math.max(visible.length, 1))
      return
    }

    if (event.key === "Enter" && popup) {
      const option = visible[highlighted]

      // Choosing from the open list is what Enter means here, not submitting the form around it.
      event.preventDefault()

      if (option) {
        choose(option)
      }
      return
    }

    if (event.key === "Tab") {
      setPopup(null)
      return
    }

    // A printable key or a deletion is typing, so the input event about to follow should narrow the open list.
    if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
      typingRef.current = true
    }
  }

  return (
    <label className="form-label-group">
      <span>Time zone</span>
      <div className="tz-field">
        <input
          aria-activedescendant={
            popup && visible.length > 0 ? `${id}-option-${highlighted}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          aria-expanded={Boolean(popup)}
          autoComplete="off"
          onBlur={() => setPopup(null)}
          onChange={(event) => {
            onChange(event.currentTarget.value)

            if (typingRef.current) {
              typingRef.current = false
              setPopup({ filtering: true })
              setHighlighted(0)
            }
          }}
          onKeyDown={handleKeyDown}
          // Escape is handled in the capture phase: the dialog's own close-on-Escape is a native listener partway up the tree, which fires before any bubbled React handler here could stop it.
          // Stopping the event at the root's capture pass is what keeps the first Escape to the list and leaves only the next one for the dialog.
          onKeyDownCapture={(event) => {
            if (event.key === "Escape" && popup) {
              event.stopPropagation()
              setPopup(null)
            }
          }}
          onPointerDown={() => {
            if (!popup) {
              openAll()
            }
          }}
          placeholder="System time zone"
          ref={inputRef}
          role="combobox"
          spellCheck={false}
          type="text"
          value={value}
        />
        {/* The arrow says there is a list behind the box; it ignores the pointer so the click lands on the input, which opens it. */}
        <svg
          aria-hidden="true"
          className="tz-field__arrow"
          fill="none"
          height="16"
          viewBox="0 0 24 24"
          width="16"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        {popup && visible.length > 0 ? (
          <div
            className="tz-field__listbox"
            id={`${id}-listbox`}
            popover="manual"
            ref={showInTopLayer}
            role="listbox"
          >
            {visible.map((option, index) => (
              <div
                aria-selected={option.value === value}
                className={`tz-field__option${
                  index === highlighted ? " tz-field__option--highlighted" : ""
                }`}
                id={`${id}-option-${index}`}
                key={option.label}
                // Pointer down, not click: it runs before the input's blur would tear the list down under the cursor.
                onPointerDown={(event) => {
                  event.preventDefault()
                  choose(option)
                }}
                onPointerMove={() => setHighlighted(index)}
                role="option"
              >
                {/* Found by a city, a country or an abbreviation, the row leads with that and the zone it stands for follows in quieter ink. */}
                {option.hint === undefined ? (
                  option.label
                ) : (
                  <>
                    {option.hint}
                    <span className="tz-field__zone"> · {option.label}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : popup ? (
          // Typing that matches nothing used to close the list without a word, and Enter then did nothing at all.
          // Saying so here is what tells a typo from a place the list doesn't have, before Save refuses it.
          <div
            className="tz-field__listbox tz-field__listbox--empty"
            popover="manual"
            ref={showInTopLayer}
            role="status"
          >
            No matching time zone
          </div>
        ) : null}
      </div>
    </label>
  )
}
