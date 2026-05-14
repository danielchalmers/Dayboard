import { getTimeZoneOptions } from "~/lib/time"
import type { BoardItem } from "~/lib/types"

interface ItemEditorProps {
  item: BoardItem
  onChange: (item: BoardItem) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  canMoveUp: boolean
  canMoveDown: boolean
}

const timeZones = getTimeZoneOptions()

export const ItemEditor = ({
  item,
  onChange,
  onDelete,
  onMove,
  canMoveDown,
  canMoveUp
}: ItemEditorProps) => {
  const update = (changes: Partial<BoardItem>) => {
    onChange({
      ...item,
      ...changes,
      kind: item.kind,
      updatedAt: new Date().toISOString()
    } as BoardItem)
  }

  return (
    <article className="editor-card">
      <div className="editor-card__header">
        <div>
          <p className="eyebrow">{item.kind}</p>
          <h2>{item.title}</h2>
        </div>
        <div className="button-row">
          <button
            aria-label={`Move ${item.title} up`}
            className="icon-button"
            disabled={!canMoveUp}
            onClick={() => onMove(item.id, -1)}
            type="button">
            ↑
          </button>
          <button
            aria-label={`Move ${item.title} down`}
            className="icon-button"
            disabled={!canMoveDown}
            onClick={() => onMove(item.id, 1)}
            type="button">
            ↓
          </button>
          <button
            className="danger-button"
            onClick={() => onDelete(item.id)}
            type="button">
            Delete
          </button>
        </div>
      </div>

      <div className="form-grid">
        <label>
          <span>Name</span>
          <input
            onChange={(event) => update({ title: event.currentTarget.value })}
            type="text"
            value={item.title}
          />
        </label>

        <label>
          <span>Time zone</span>
          <input
            list="clockboard-time-zones"
            onChange={(event) =>
              update({ timeZone: event.currentTarget.value })
            }
            type="text"
            value={item.timeZone}
          />
        </label>

        {item.kind === "clock" ? (
          <p className="form-note">
            Clockboard uses your system clock format automatically.
          </p>
        ) : (
          <label>
            <span>When</span>
            <input
              onChange={(event) =>
                update({ targetDateTime: event.currentTarget.value })
              }
              type="datetime-local"
              value={item.targetDateTime}
            />
          </label>
        )}
      </div>
      <datalist id="clockboard-time-zones">
        {timeZones.map((timeZone) => (
          <option key={timeZone} value={timeZone} />
        ))}
      </datalist>
    </article>
  )
}
