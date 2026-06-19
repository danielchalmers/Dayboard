import { useEffect } from "react"

import {
  BOARD_COLUMN_CHOICES,
  type BoardColumns,
  type ClockboardSettings
} from "~/lib/types"

interface SettingsDialogProps {
  isOpen: boolean
  settings: ClockboardSettings
  onChange: (settings: ClockboardSettings) => void
  onClose: () => void
}

const columnLabel = (columns: BoardColumns): string =>
  columns === "auto" ? "Auto" : `${columns}`

export const SettingsDialog = ({
  isOpen,
  settings,
  onChange,
  onClose
}: SettingsDialogProps) => {
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

  if (!isOpen) {
    return null
  }

  const setColumns = (value: string) => {
    onChange({
      ...settings,
      columns: value === "auto" ? "auto" : (Number(value) as BoardColumns)
    })
  }

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}>
      <section
        aria-labelledby="settings-dialog-title"
        aria-modal="true"
        className="modal-dialog modal-dialog--narrow"
        role="dialog">
        <div className="modal-dialog__header">
          <div>
            <h2 className="modal-dialog__title" id="settings-dialog-title">
              Options
            </h2>
            <p className="modal-dialog__subtitle">
              These apply to every Clockboard tab.
            </p>
          </div>
        </div>

        <div className="options-list">
          <div className="option-row">
            <div className="option-row__text">
              <label className="option-row__label" htmlFor="settings-drag-to-move">
                Drag to rearrange
              </label>
              <span className="option-row__hint">
                Grab a widget&rsquo;s edge to reorder the board.
              </span>
            </div>
            <label className="switch">
              <input
                checked={settings.dragToMove}
                className="switch__input"
                id="settings-drag-to-move"
                onChange={(event) =>
                  onChange({ ...settings, dragToMove: event.currentTarget.checked })
                }
                role="switch"
                type="checkbox"
              />
              <span aria-hidden="true" className="switch__track" />
            </label>
          </div>

          <div className="option-row">
            <div className="option-row__text">
              <label className="option-row__label" htmlFor="settings-columns">
                Columns
              </label>
              <span className="option-row__hint">
                Auto fits as many as the width allows.
              </span>
            </div>
            <select
              className="option-row__control"
              id="settings-columns"
              onChange={(event) => setColumns(event.currentTarget.value)}
              value={String(settings.columns)}>
              {BOARD_COLUMN_CHOICES.map((choice) => (
                <option key={choice} value={String(choice)}>
                  {columnLabel(choice)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-dialog__actions">
          <button className="primary-button" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </section>
    </div>
  )
}
