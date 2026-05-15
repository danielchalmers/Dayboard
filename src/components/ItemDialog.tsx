import { useEffect, useMemo, useState } from "react"

import { getTimeZoneOptions } from "~/lib/time"
import type { BoardItem } from "~/lib/types"

interface ItemDialogProps {
  isOpen: boolean
  item: BoardItem | null
  mode: "add" | "edit"
  onClose: () => void
  onSave: (item: BoardItem) => void
}

const timeZones = getTimeZoneOptions()

export const ItemDialog = ({
  isOpen,
  item,
  mode,
  onClose,
  onSave
}: ItemDialogProps) => {
  const [draft, setDraft] = useState<BoardItem | null>(item)

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

    return mode === "add"
      ? draft.kind === "clock"
        ? "Add clock"
        : "Add countdown"
      : `Edit ${draft.title}`
  }, [draft, mode])

  if (!isOpen || !draft) {
    return null
  }

  const update = (changes: Partial<BoardItem>) => {
    setDraft((current) =>
      current
        ? ({
            ...current,
            ...changes,
            kind: current.kind
          } as BoardItem)
        : current
    )
  }

  const submitLabel =
    mode === "add"
      ? draft.kind === "clock"
        ? "Save clock"
        : "Save countdown"
      : "Save changes"

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="item-dialog-title"
        aria-modal="true"
        className="modal-dialog"
        role="dialog">
        <div className="modal-dialog__header">
          <div>
            <p className="eyebrow">{draft.kind}</p>
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
                onChange={(event) => update({ title: event.currentTarget.value })}
                required
                type="text"
                value={draft.title}
              />
            </label>

            <label>
              <span>Time zone</span>
              <input
                list="clockboard-time-zones"
                onChange={(event) => update({ timeZone: event.currentTarget.value })}
                required
                type="text"
                value={draft.timeZone}
              />
            </label>

            {draft.kind === "countdown" ? (
              <label>
                <span>When</span>
                <input
                  onChange={(event) =>
                    update({ targetDateTime: event.currentTarget.value })
                  }
                  required
                  type="datetime-local"
                  value={draft.targetDateTime}
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
