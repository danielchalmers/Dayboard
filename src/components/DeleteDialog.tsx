import { useEffect } from "react"

import type { Widget } from "~/lib/types"
import { widgetRegistry } from "~/lib/widgets"

interface DeleteDialogProps {
  isOpen: boolean
  item: Widget | null
  onCancel: () => void
  onConfirm: (item: Widget) => void
}

export const DeleteDialog = ({
  isOpen,
  item,
  onCancel,
  onConfirm
}: DeleteDialogProps) => {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen || !item) {
    return null
  }

  const widgetDefinition = widgetRegistry[item.kind]

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="delete-dialog-title"
        aria-modal="true"
        className="modal-dialog modal-dialog--narrow"
        role="dialog">
        <div className="modal-dialog__header">
          <div>
            <h2 className="modal-dialog__title" id="delete-dialog-title">
              Delete {widgetDefinition.kind}?
            </h2>
            <p className="modal-dialog__subtitle">
              This removes {item.title} from your board.
            </p>
          </div>
        </div>

        <div className="modal-dialog__actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="danger-button"
            onClick={() => onConfirm(item)}
            type="button">
            Delete widget
          </button>
        </div>
      </section>
    </div>
  )
}
