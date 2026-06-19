import { useRef } from "react"

import { useModalFocus } from "~/hooks/useModalFocus"
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
  onExport?: () => void
  onImport?: (file: File) => void
}

const columnLabel = (columns: BoardColumns): string =>
  columns === "auto" ? "Auto" : `${columns}`

export const SettingsDialog = ({
  isOpen,
  settings,
  onChange,
  onClose,
  onExport,
  onImport
}: SettingsDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  useModalFocus(isOpen, dialogRef, onClose)

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
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}>
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

        <div className="settings-fields">
          <label className="form-label-group">
            <span>Your name</span>
            <input
              onChange={(event) =>
                onChange({ ...settings, name: event.currentTarget.value })
              }
              placeholder="Optional, for your greeting"
              type="text"
              value={settings.name}
            />
          </label>

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

          <div className="option-row">
            <div className="option-row__text">
              <label className="option-row__label" htmlFor="settings-chime">
                Timer chime
              </label>
              <span className="option-row__hint">
                Play a soft sound when a timer reaches zero.
              </span>
            </div>
            <label className="switch">
              <input
                checked={settings.chimeOnTimerEnd}
                className="switch__input"
                id="settings-chime"
                onChange={(event) =>
                  onChange({
                    ...settings,
                    chimeOnTimerEnd: event.currentTarget.checked
                  })
                }
                role="switch"
                type="checkbox"
              />
              <span aria-hidden="true" className="switch__track" />
            </label>
          </div>
          </div>

          <div className="form-label-group">
            <span>Board</span>
            <div className="settings-actions">
              <button
                className="secondary-button"
                onClick={onExport}
                type="button">
                Export
              </button>
              <button
                className="secondary-button"
                onClick={() => fileInputRef.current?.click()}
                type="button">
                Import
              </button>
              <input
                accept="application/json,.json"
                aria-label="Import board file"
                hidden
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  if (file) {
                    onImport?.(file)
                  }
                  event.currentTarget.value = ""
                }}
                ref={fileInputRef}
                type="file"
              />
            </div>
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
