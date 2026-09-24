import { useEffect, useMemo, useRef, useState } from "react"

import { useModalFocus } from "~/hooks/useModalFocus"
import {
  dateTimeInputValueToIsoInstant,
  isoInstantToDateTimeInputValue
} from "~/lib/time"
import { quotesToText, textToQuotes } from "~/lib/quotes"
import { msToParts, partsToMs, type DurationParts } from "~/lib/timers"
import type {
  CountdownRepeat,
  QuoteRotation,
  Widget,
  WidgetColorPreset,
  WidgetKind
} from "~/lib/types"
import { widgetRegistry } from "~/lib/widgets"
import { ColorPresetPicker } from "~/components/ColorPresetPicker"
import { TimeZoneField } from "~/components/TimeZoneField"
import { WidgetIcon } from "~/components/WidgetIcon"

interface ItemDialogProps {
  isOpen: boolean
  item: Widget | null
  mode: "add" | "edit"
  onClose: () => void
  onSave: (item: Widget) => void
}

export const ItemDialog = ({
  isOpen,
  item,
  mode,
  onClose,
  onSave
}: ItemDialogProps) => {
  const [draft, setDraft] = useState<Widget | null>(item)
  // Raw strings for the datetime-local fields so a cleared/intermediate value is shown as typed instead of snapping back to the stored target.
  const [targetInput, setTargetInput] = useState<string | null>(null)
  const [startInput, setStartInput] = useState<string | null>(null)
  const [syncedItem, setSyncedItem] = useState(item)
  const dialogRef = useRef<HTMLElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const lengthRef = useRef<HTMLInputElement>(null)

  // Adopt a newly opened item during render (not in an effect) so the dialog body, and the focusable section that useModalFocus wires into, exist on the very first open render.
  // Deferring the draft to an effect left the section null for one render, after which the focus hook's deps never changed again, so focus-move, the focus trap, and Escape-to-close were silently never attached.
  if (item !== syncedItem) {
    setSyncedItem(item)
    setDraft(item)
    setTargetInput(null)
    setStartInput(null)
  }

  useModalFocus(isOpen, dialogRef, onClose)

  // A timer with no length would read "Time's up" the moment it was saved, and storage reads a zero length back as the default five minutes.
  // Marking the length invalid lets native validation hold the save, the same as an empty required field.
  const isLengthless = draft?.kind === "timer" && draft.settings.durationMs <= 0
  useEffect(() => {
    lengthRef.current?.setCustomValidity(isLengthless ? "Give it a length." : "")
  }, [isLengthless])

  const title = useMemo(
    () => (draft ? `${mode === "add" ? "Add" : "Edit"} ${draft.kind}` : ""),
    [draft, mode]
  )

  if (!isOpen || !draft) {
    return null
  }

  const widgetDefinition = widgetRegistry[draft.kind]

  const submitLabel = mode === "add" ? `Save ${draft.kind}` : "Save changes"

  // What the Starting from field shows right now: the raw string mid-edit, else the stored start.
  const startValue =
    draft.kind === "countdown"
      ? startInput ?? isoInstantToDateTimeInputValue(draft.settings.startAt ?? "")
      : ""

  const updateTitle = (title: string) => {
    setDraft((current) => (current ? { ...current, title } : current))
  }

  const updateColorPreset = (colorPreset: WidgetColorPreset) => {
    setDraft((current) => (current ? { ...current, colorPreset } : current))
  }

  // Merge a patch into the draft's settings, leaving the fields the form didn't touch alone.
  // Every field belongs to exactly one kind, so the runtime check both guards a stale draft and is what makes the cast sound: the spread is only reached once `current` really is that kind.
  const patchSettings = <K extends WidgetKind>(
    kind: K,
    patch: Partial<Extract<Widget, { kind: K }>["settings"]>
  ) => {
    setDraft((current) =>
      current?.kind === kind
        ? ({ ...current, settings: { ...current.settings, ...patch } } as Widget)
        : current
    )
  }

  const updateTimeZone = (timeZone: string) => {
    patchSettings("clock", { timeZone })
  }

  const updateTargetAt = (value: string) => {
    setTargetInput(value)
    const targetAt = dateTimeInputValueToIsoInstant(value)

    // Patching leaves startAt/repeat in place when only the target changes.
    if (targetAt) {
      patchSettings("countdown", { targetAt })
    }
  }

  const updateRepeat = (value: string) => {
    patchSettings("countdown", { repeat: value as CountdownRepeat })
  }

  // Clearing the field is a real choice, not an intermediate state: an empty start drops the progress bar and puts the card back to time remaining.
  // A value that is present but not yet a whole date is mid-typing, so the draft stays as it was.
  const updateStartAt = (value: string) => {
    setStartInput(value)
    const startAt = dateTimeInputValueToIsoInstant(value)

    if (value !== "" && !startAt) {
      return
    }

    patchSettings("countdown", { startAt: startAt ?? undefined })
  }

  const updateQuotes = (value: string) => {
    patchSettings("quote", { quotes: textToQuotes(value) })
  }

  const updateRotation = (value: string) => {
    patchSettings("quote", { rotation: value as QuoteRotation })
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
    patchSettings("timer", { chime })
  }

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        // Clicking the backdrop commits the edit, the same as pressing Save or Enter, so dismissing the dialog feels fluid instead of throwing the work away.
        // Native form validation still blocks the save and keeps the dialog open if a required field is empty.
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
        <div className="modal-dialog__header modal-dialog__header--with-badge">
          <span
            aria-hidden="true"
            className="menu-chip menu-chip--large">
            <WidgetIcon kind={draft.kind} size={22} />
          </span>
          <h2 className="modal-dialog__title" id="item-dialog-title">
            {title}
          </h2>
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

            {draft.kind === "clock" ? (
              <TimeZoneField
                onChange={updateTimeZone}
                value={draft.settings.timeZone}
              />
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
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>

                <label className="form-label-group">
                  <span>Starting from</span>
                  <div className="input-adorned">
                    <input
                      onChange={(event) =>
                        updateStartAt(event.currentTarget.value)
                      }
                      type="datetime-local"
                      value={startValue}
                    />
                    {startValue !== "" ? (
                      <button
                        aria-label="Clear starting from"
                        className="input-adorned__clear"
                        onClick={() => updateStartAt("")}
                        title="Clear"
                        type="button">
                        <svg
                          aria-hidden="true"
                          fill="none"
                          height="14"
                          viewBox="0 0 24 24"
                          width="14">
                          <path
                            d="M6 6l12 12M18 6 6 18"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="2"
                          />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </label>
                <p className="form-note">
                  Optional. Set a start and the card becomes a progress bar
                  filling from there to the target; leave it empty to show the
                  time remaining.
                </p>
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
                Mark it done each day on the card to fill in your week.
              </p>
            ) : null}

            {draft.kind === "todo" ? (
              <p className="form-note">
                Add and check off tasks right on the card. It holds four at a
                time &mdash; the few things you&rsquo;re actually doing today.
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
                          ref={part === "hours" ? lengthRef : undefined}
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
                  {/* The one-per-line rule is only in the placeholder, which is gone the moment there is a quote in the box. */}
                  <span>Quotes (one per line)</span>
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
      </section>
    </div>
  )
}
