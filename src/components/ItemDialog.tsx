import { useEffect, useMemo, useState } from "react"

import {
  dateTimeInputValueToIsoInstant,
  getTimeZoneOptions,
  isoInstantToDateTimeInputValue
} from "~/lib/time"
import type { Widget, WidgetColorPreset } from "~/lib/types"
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

  const updateColorPreset = (colorPreset: WidgetColorPreset) => {
    setDraft((current) => (current ? { ...current, colorPreset } : current))
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
              <label className="form-label-group">
                <span>Time zone</span>
                <input
                  list="clockboard-time-zones"
                  onChange={(event) => updateTimeZone(event.currentTarget.value)}
                  required
                  type="text"
                  value={draft.settings.timeZone}
                  placeholder="Select time zone..."
                />
              </label>
            ) : null}

            {draft.kind === "countdown" ? (
              <label className="form-label-group">
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
