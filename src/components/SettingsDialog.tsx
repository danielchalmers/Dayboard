import { useRef, useState } from "react"

import { useAutoSave } from "~/hooks/useAutoSave"
import { useModalFocus } from "~/hooks/useModalFocus"
import type { DayboardSettings } from "~/lib/types"

interface SettingsDialogProps {
  isOpen: boolean
  settings: DayboardSettings
  /** Resolves to why storage refused the change, or null once it is saved. `isShown` says whether the name is still on screen to say why beside it. */
  onChange: (
    settings: DayboardSettings,
    isShown?: () => boolean
  ) => Promise<string | null> | void
  onClose: () => void
  onExport?: () => void
  onImport?: (file: File) => void
  importError?: string | null
}

// The name saves the way a note does (see useAutoSave): a beat after typing stops, on leaving the field, and as Options closes or the page is hidden.
// A write per keystroke could run into the sync write-rate limit within one name, and a refused one put the stored name back over what was being typed.
// Options covers the board and its notice, so a refusal is told here, beside the words it kept, for as long as it keeps them.
// Options also puts focus on the name as it opens, so unlike a note, a focused name with nothing typed in it still takes a change made in another tab.
const NameSection = ({
  settings,
  onChange
}: Pick<SettingsDialogProps, "settings" | "onChange">) => {
  const [refusal, setRefusal] = useState<string | null>(null)
  const field = useAutoSave<HTMLInputElement>(
    settings.name,
    async (name, isShown) => {
      const refused = (await onChange({ ...settings, name }, isShown)) ?? null

      setRefusal(refused)
      return refused
    },
    { adoptWhileFocused: true }
  )

  return (
    <section className="settings-section">
      <label className="form-label-group">
        <span>Your name</span>
        <input
          dir="auto"
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(event.currentTarget.value)}
          placeholder="Optional"
          ref={field.fieldRef}
          type="text"
          value={field.value}
        />
      </label>
      <p className="form-note">
        Used to greet you at the top of every new tab.
      </p>
      {refusal ? (
        <p className="form-note form-note--error" role="alert">
          {refusal}
        </p>
      ) : null}
    </section>
  )
}

// Dayboard keeps options to a minimum on purpose: the layout, dragging, and placement all just work.
// What's left is the greeting name and moving the board between browsers.
export const SettingsDialog = ({
  isOpen,
  settings,
  onChange,
  onClose,
  onExport,
  onImport,
  importError
}: SettingsDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  useModalFocus(isOpen, dialogRef, onClose)

  if (!isOpen) {
    return null
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
        className="modal-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}>
        <div className="modal-dialog__header">
          <h2 className="modal-dialog__title" id="settings-dialog-title">
            Options
          </h2>
        </div>

        <div className="settings-sections">
          <NameSection onChange={onChange} settings={settings} />

          <section className="settings-section">
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
            <p className="form-note">
              Save your board to a file, or bring one in from another browser.
            </p>
            {importError ? (
              <p className="form-note form-note--error" role="alert">
                {importError}
              </p>
            ) : null}
          </section>
        </div>

        <div className="modal-dialog__actions modal-dialog__actions--split">
          <div className="settings-footer-links">
            <a
              className="settings-footer-link"
              href="https://github.com/danielchalmers/Dayboard"
              rel="noreferrer"
              target="_blank">
              <svg
                aria-hidden="true"
                fill="currentColor"
                height="16"
                viewBox="0 0 16 16"
                width="16">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              Dayboard on GitHub
            </a>
            <a
              className="settings-footer-link"
              href="https://github.com/danielchalmers/Dayboard/issues"
              rel="noreferrer"
              target="_blank">
              <svg
                aria-hidden="true"
                fill="currentColor"
                height="16"
                viewBox="0 0 16 16"
                width="16">
                <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
              </svg>
              Give feedback
            </a>
          </div>
          <button className="primary-button" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </section>
    </div>
  )
}
