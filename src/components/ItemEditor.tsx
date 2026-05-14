import { getTimeZoneOptions } from "~/lib/time"
import { DEFAULT_COLORS, type BoardItem } from "~/lib/types"

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
          <span>Title</span>
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

        <label>
          <span>Color</span>
          <select
            onChange={(event) => update({ color: event.currentTarget.value })}
            value={item.color}>
            {DEFAULT_COLORS.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </label>

        {item.kind === "clock" ? (
          <>
            <label>
              <span>Format</span>
              <select
                onChange={(event) =>
                  update({ format: event.currentTarget.value as "12h" | "24h" })
                }
                value={item.format}>
                <option value="12h">12 hour</option>
                <option value="24h">24 hour</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                checked={item.showSeconds}
                onChange={(event) =>
                  update({ showSeconds: event.currentTarget.checked })
                }
                type="checkbox"
              />
              <span>Show seconds</span>
            </label>
          </>
        ) : (
          <>
            <label>
              <span>Target date and time</span>
              <input
                onChange={(event) =>
                  update({ targetDateTime: event.currentTarget.value })
                }
                type="datetime-local"
                value={item.targetDateTime}
              />
            </label>
            <label className="checkbox-label">
              <input
                checked={item.showSeconds}
                onChange={(event) =>
                  update({ showSeconds: event.currentTarget.checked })
                }
                type="checkbox"
              />
              <span>Show seconds</span>
            </label>
          </>
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
