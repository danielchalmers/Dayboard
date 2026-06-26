import { useMemo, useRef, useState } from "react"

import { useModalFocus } from "~/hooks/useModalFocus"
import {
  dateTimeInputValueToIsoInstant,
  getTimeZoneOptions,
  isoInstantToDateTimeInputValue
} from "~/lib/time"
import { quotesToText, textToQuotes } from "~/lib/quotes"
import { msToParts, partsToMs, type DurationParts } from "~/lib/timers"
import type {
  CountdownDisplay,
  CountdownRepeat,
  QuoteRotation,
  Widget,
  WidgetColorPreset,
  WidgetSize
} from "~/lib/types"
import { widgetRegistry } from "~/lib/widgets"
import { ColorPresetPicker } from "~/components/ColorPresetPicker"

interface ItemDialogProps {
  isOpen: boolean
  item: Widget | null
  mode: "add" | "edit"
  onClose: () => void
  onSave: (item: Widget) => void
}

const timeZones = getTimeZoneOptions()

export const ItemDialog = ({
  isOpen,
  item,
  mode,
  onClose,
  onSave
}: ItemDialogProps) => {
  const [draft, setDraft] = useState<Widget | null>(item)
  // Raw strings for the datetime-local fields so a cleared/intermediate value is
  // shown as typed instead of snapping back to the stored target.
  const [targetInput, setTargetInput] = useState<string | null>(null)
  const [startInput, setStartInput] = useState<string | null>(null)
  const [syncedItem, setSyncedItem] = useState(item)
  const dialogRef = useRef<HTMLElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Adopt a newly opened item during render (not in an effect) so the dialog
  // body — and the focusable section that useModalFocus wires into — exist on
  // the very first open render. Deferring the draft to an effect left the
  // section null for one render, after which the focus hook's deps never
  // changed again, so focus-move, the focus trap, and Escape-to-close were
  // silently never attached.
  if (item !== syncedItem) {
    setSyncedItem(item)
    setDraft(item)
    setTargetInput(null)
    setStartInput(null)
  }

  useModalFocus(isOpen, dialogRef, onClose)

  const title = useMemo(() => {
    if (!draft) {
      return ""
    }

    const widgetDefinition = widgetRegistry[draft.kind]

    return mode === "add"
      ? `Add ${widgetDefinition.kind}`
      : `Edit ${widgetDefinition.kind}`
  }, [draft, mode])

  if (!isOpen || !draft) {
    return null
  }

  const widgetDefinition = widgetRegistry[draft.kind]

  const submitLabel =
    mode === "add" ? `Save ${widgetDefinition.kind}` : "Save changes"

  const updateTitle = (title: string) => {
    setDraft((current) => (current ? { ...current, title } : current))
  }

  const updateColorPreset = (colorPreset: WidgetColorPreset) => {
    setDraft((current) => (current ? { ...current, colorPreset } : current))
  }

  const updateSize = (size: WidgetSize) => {
    setDraft((current) => (current ? { ...current, size } : current))
  }

  const updateTimeZone = (timeZone: string) => {
    setDraft((current) =>
      current?.kind === "clock"
        ? {
            ...current,
            settings: {
              timeZone
            }
          }
        : current
    )
  }

  const updateTargetAt = (value: string) => {
    setTargetInput(value)
    const targetAt = dateTimeInputValueToIsoInstant(value)

    setDraft((current) =>
      current?.kind === "countdown" && targetAt
        ? {
            // Preserve display/startAt/repeat when only the target changes.
            ...current,
            settings: { ...current.settings, targetAt }
          }
        : current
    )
  }

  const updateDisplay = (value: string) => {
    const display = value as CountdownDisplay

    setDraft((current) => {
      if (current?.kind !== "countdown") {
        return current
      }

      return {
        ...current,
        settings: {
          ...current.settings,
          display,
          // Progress needs a span start; default it to now if none is set yet.
          startAt:
            display === "progress" && !current.settings.startAt
              ? new Date().toISOString()
              : current.settings.startAt
        }
      }
    })
  }

  const updateRepeat = (value: string) => {
    setDraft((current) =>
      current?.kind === "countdown"
        ? {
            ...current,
            settings: { ...current.settings, repeat: value as CountdownRepeat }
          }
        : current
    )
  }

  const updateStartAt = (value: string) => {
    setStartInput(value)
    const startAt = dateTimeInputValueToIsoInstant(value)

    setDraft((current) =>
      current?.kind === "countdown" && startAt
        ? { ...current, settings: { ...current.settings, startAt } }
        : current
    )
  }

  const updateQuotes = (value: string) => {
    setDraft((current) =>
      current?.kind === "quote"
        ? { ...current, settings: { ...current.settings, quotes: textToQuotes(value) } }
        : current
    )
  }

  const updateRotation = (value: string) => {
    setDraft((current) =>
      current?.kind === "quote"
        ? {
            ...current,
            settings: { ...current.settings, rotation: value as QuoteRotation }
          }
        : current
    )
  }

  const updateDuration = (part: keyof DurationParts, value: number) => {
    setDraft((current) => {
      if (current?.kind !== "timer") {
        return current
      }

      const parts = {
        ...msToParts(current.settings.durationMs),
        [part]: Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
      }
      const durationMs = partsToMs(parts)

      // Changing the length resets the timer so it starts from the new duration.
      return {
        ...current,
        settings: {
          ...current.settings,
          durationMs,
          remainingMs: durationMs,
          running: false,
          endsAt: null
        }
      }
    })
  }

  const updateChime = (chime: boolean) => {
    setDraft((current) =>
      current?.kind === "timer"
        ? { ...current, settings: { ...current.settings, chime } }
        : current
    )
  }

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        // Clicking the backdrop commits the edit — the same as pressing Save or
        // Enter — so dismissing the dialog feels fluid instead of throwing the
        // work away. Native form validation still blocks the save and keeps the
        // dialog open if a required field is empty.
        if (event.target === event.currentTarget) {
          formRef.current?.requestSubmit()
        }
      }}>
      <section
        aria-labelledby="item-dialog-title"
        aria-modal="true"
        className="modal-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}>
        <div className="modal-dialog__header">
          <div>
            <h2 className="modal-dialog__title" id="item-dialog-title">
              {title}
            </h2>
          </div>
        </div>

        <form
          className="dialog-form"
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault()
            onSave(draft)
          }}>
          <div className="form-grid">
            <label className="form-label-group">
              <span>Name</span>
              <input
                onChange={(event) => updateTitle(event.currentTarget.value)}
                required
                type="text"
                value={draft.title}
                placeholder="Give it a name..."
              />
            </label>

            <ColorPresetPicker
              value={draft.colorPreset}
              onChange={updateColorPreset}
            />

            <label className="form-label-group">
              <span>Size</span>
              <select
                onChange={(event) =>
                  updateSize(event.currentTarget.value as WidgetSize)
                }
                value={draft.size ?? "standard"}>
                <option value="standard">Standard</option>
                <option value="wide">Wide (two columns)</option>
              </select>
            </label>

            {draft.kind === "clock" ? (
              <label className="form-label-group">
                <span>Time zone</span>
                <input
                  list="dayboard-time-zones"
                  onChange={(event) => updateTimeZone(event.currentTarget.value)}
                  required
                  type="text"
                  value={draft.settings.timeZone}
                  placeholder="Select time zone..."
                />
              </label>
            ) : null}

            {draft.kind === "countdown" ? (
              <>
                <label className="form-label-group">
                  <span>{widgetDefinition.editor.targetLabel}</span>
                  <input
                    onChange={(event) => updateTargetAt(event.currentTarget.value)}
                    required
                    type="datetime-local"
                    value={
                      targetInput ??
                      isoInstantToDateTimeInputValue(draft.settings.targetAt)
                    }
                  />
                </label>

                <label className="form-label-group">
                  <span>Repeats</span>
                  <select
                    onChange={(event) => updateRepeat(event.currentTarget.value)}
                    value={draft.settings.repeat ?? "none"}>
                    <option value="none">Never</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>

                <label className="form-label-group">
                  <span>Display</span>
                  <select
                    onChange={(event) => updateDisplay(event.currentTarget.value)}
                    value={draft.settings.display ?? "text"}>
                    <option value="text">Time remaining</option>
                    <option value="progress">Progress bar</option>
                  </select>
                </label>

                {draft.settings.display === "progress" ? (
                  <>
                    <label className="form-label-group">
                      <span>Starting from</span>
                      <input
                        onChange={(event) =>
                          updateStartAt(event.currentTarget.value)
                        }
                        required
                        type="datetime-local"
                        value={
                          startInput ??
                          isoInstantToDateTimeInputValue(
                            draft.settings.startAt ?? ""
                          )
                        }
                      />
                    </label>
                    <p className="form-note">
                      The bar fills from this date (when the countdown began) to
                      the target.
                    </p>
                  </>
                ) : null}
              </>
            ) : null}

            {draft.kind === "clock" ? (
              <p className="form-note">
                Dayboard uses your system clock format automatically.
              </p>
            ) : null}

            {draft.kind === "note" ? (
              <p className="form-note">
                Type your note directly on the card &mdash; it saves itself.
              </p>
            ) : null}

            {draft.kind === "stopwatch" ? (
              <p className="form-note">
                Start, pause, and reset the stopwatch with the buttons on the
                card.
              </p>
            ) : null}

            {draft.kind === "habit" ? (
              <p className="form-note">
                Mark it done each day on the card to build your streak.
              </p>
            ) : null}

            {draft.kind === "timer" ? (
              <>
                <div className="form-label-group">
                  <span>Length</span>
                  <div className="duration-field">
                    {(
                      [
                        { part: "hours", label: "hrs", max: 99 },
                        { part: "minutes", label: "min", max: 59 },
                        { part: "seconds", label: "sec", max: 59 }
                      ] as const
                    ).map(({ part, label, max }) => (
                      <label className="duration-field__part" key={part}>
                        <input
                          aria-label={part}
                          max={max}
                          min={0}
                          onChange={(event) =>
                            updateDuration(
                              part,
                              event.currentTarget.valueAsNumber
                            )
                          }
                          type="number"
                          value={msToParts(draft.settings.durationMs)[part]}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="option-row">
                  <div className="option-row__text">
                    <label
                      className="option-row__label"
                      htmlFor="item-timer-chime">
                      Chime when it ends
                    </label>
                    <span className="option-row__hint">
                      Play a soft sound when this timer reaches zero.
                    </span>
                  </div>
                  <label className="switch">
                    <input
                      checked={draft.settings.chime ?? false}
                      className="switch__input"
                      id="item-timer-chime"
                      onChange={(event) =>
                        updateChime(event.currentTarget.checked)
                      }
                      role="switch"
                      type="checkbox"
                    />
                    <span aria-hidden="true" className="switch__track" />
                  </label>
                </div>
              </>
            ) : null}

            {draft.kind === "quote" ? (
              <>
                <label className="form-label-group">
                  <span>Quotes</span>
                  <textarea
                    className="quote-list-input"
                    onChange={(event) => updateQuotes(event.currentTarget.value)}
                    placeholder="One quote per line..."
                    rows={6}
                    value={quotesToText(draft.settings.quotes)}
                  />
                </label>

                <label className="form-label-group">
                  <span>Show a new one</span>
                  <select
                    onChange={(event) => updateRotation(event.currentTarget.value)}
                    value={draft.settings.rotation}>
                    <option value="daily">Each day</option>
                    <option value="open">Every time I open a tab</option>
                  </select>
                </label>
              </>
            ) : null}
          </div>

          <div className="modal-dialog__actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" type="submit">
              {submitLabel}
            </button>
          </div>
        </form>

        <datalist id="dayboard-time-zones">
          {timeZones.map((timeZone) => (
            <option key={timeZone} value={timeZone} />
          ))}
        </datalist>
      </section>
    </div>
  )
}
