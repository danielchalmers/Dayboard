import { useRef } from "react"

import { useModalFocus } from "~/hooks/useModalFocus"
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
  const dialogRef = useRef<HTMLElement>(null)

  useModalFocus(isOpen, dialogRef, onCancel)

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
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}>
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
