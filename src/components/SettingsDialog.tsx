import { useEffect } from "react"

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsDialog = ({ isOpen, onClose }: SettingsDialogProps) => {
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

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="settings-dialog-title"
        aria-modal="true"
        className="modal-dialog modal-dialog--narrow"
        role="dialog">
        <div className="modal-dialog__header">
          <p className="eyebrow">Settings</p>
          <h2 className="modal-dialog__title" id="settings-dialog-title">
            Clockboard settings
          </h2>
          <p className="modal-dialog__subtitle">
            Time format, theme, and dates follow your system for now.
          </p>
        </div>

        <div className="settings-placeholder">
          <p>Global options will live here when they are ready.</p>
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
