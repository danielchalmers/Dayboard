import { useEffect } from "react"

import type { WidgetKind } from "~/lib/types"
import { widgetRegistry } from "~/lib/widgets"

interface AddWidgetDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelectKind: (kind: WidgetKind) => void
}

export const AddWidgetDialog = ({
  isOpen,
  onClose,
  onSelectKind
}: AddWidgetDialogProps) => {
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
        aria-labelledby="add-widget-dialog-title"
        aria-modal="true"
        className="modal-dialog modal-dialog--narrow"
        role="dialog">
        <div className="modal-dialog__header">
          <p className="eyebrow">Add</p>
          <h2 className="modal-dialog__title" id="add-widget-dialog-title">
            Add widget
          </h2>
        </div>

        <div className="type-chooser" role="list">
          <button
            className="type-choice"
            onClick={() => onSelectKind("clock")}
            type="button">
            <span>{widgetRegistry.clock.kindLabel}</span>
            <span>Live time in any time zone.</span>
          </button>
          <button
            className="type-choice"
            onClick={() => onSelectKind("countdown")}
            type="button">
            <span>{widgetRegistry.countdown.kindLabel}</span>
            <span>Natural language time until a moment.</span>
          </button>
        </div>

        <div className="modal-dialog__actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </section>
    </div>
  )
}
