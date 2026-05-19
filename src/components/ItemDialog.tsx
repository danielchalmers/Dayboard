import { useEffect, useMemo, useState, type CSSProperties } from "react"

import {
  dateTimeInputValueToIsoInstant,
  getTimeZoneOptions,
  isoInstantToDateTimeInputValue
} from "~/lib/time"
import {
  WIDGET_COLOR_INPUT_FALLBACK,
  WIDGET_COLOR_OPTIONS,
  type Widget,
  type WidgetColor
} from "~/lib/types"
import { widgetRegistry } from "~/lib/widgets"

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

  useEffect(() => {
    setDraft(item)
  }, [item])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

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
    const targetAt = dateTimeInputValueToIsoInstant(value)

    setDraft((current) =>
      current?.kind === "countdown" && targetAt
        ? {
            ...current,
            settings: {
              targetAt
            }
          }
        : current
    )
  }

  const updateColor = (color: WidgetColor) => {
    setDraft((current) => (current ? { ...current, color } : current))
  }

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="item-dialog-title"
        aria-modal="true"
        className="modal-dialog"
        role="dialog">
        <div className="modal-dialog__header">
          <div>
            <h2 className="modal-dialog__title" id="item-dialog-title">
              {title}
            </h2>
          </div>
        </div>

        <form
          className="dialog-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSave({
              ...draft,
              updatedAt: new Date().toISOString()
            })
          }}>
          <div className="form-grid">
            <label>
              <span>Name</span>
              <input
                onChange={(event) => updateTitle(event.currentTarget.value)}
                required
                type="text"
                value={draft.title}
              />
            </label>

            {draft.kind === "clock" ? (
              <label>
                <span>Time zone</span>
                <input
                  list="clockboard-time-zones"
                  onChange={(event) => updateTimeZone(event.currentTarget.value)}
                  required
                  type="text"
                  value={draft.settings.timeZone}
                />
              </label>
            ) : null}

            <fieldset className="color-picker">
              <legend>Color</legend>
              <div className="color-picker__options">
                {WIDGET_COLOR_OPTIONS.map((option) => {
                  const optionId = `widget-color-${option.value ?? "theme"}`
                  const swatchStyle =
                    option.value === null
                      ? undefined
                      : ({
                          "--swatch-color": option.value
                        } as CSSProperties)

                  return (
                    <label
                      className="color-picker__option"
                      data-selected={draft.color === option.value}
                      key={optionId}>
                      <input
                        checked={draft.color === option.value}
                        name="widget-color"
                        onChange={() => updateColor(option.value)}
                        type="radio"
                        value={option.value ?? WIDGET_COLOR_INPUT_FALLBACK}
                      />
                      <span className="color-picker__swatch" style={swatchStyle} />
                      <span className="color-picker__label">{option.label}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {draft.kind === "countdown" ? (
              <label>
                <span>{widgetDefinition.editor.targetLabel}</span>
                <input
                  onChange={(event) => updateTargetAt(event.currentTarget.value)}
                  required
                  type="datetime-local"
                  value={isoInstantToDateTimeInputValue(draft.settings.targetAt)}
                />
              </label>
            ) : (
              <p className="form-note">
                Clockboard uses your system clock format automatically.
              </p>
            )}
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

        <datalist id="clockboard-time-zones">
          {timeZones.map((timeZone) => (
            <option key={timeZone} value={timeZone} />
          ))}
        </datalist>
      </section>
    </div>
  )
}
