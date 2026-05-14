import { useMemo } from "react"

import { BoardList } from "~/components/BoardList"
import { ItemEditor } from "~/components/ItemEditor"
import { PageShell } from "~/components/PageShell"
import { ErrorView, LoadingView } from "~/components/StatusViews"
import { useClockboardState } from "~/hooks/useClockboardState"
import { useNow } from "~/hooks/useNow"
import { createBoardItem } from "~/lib/items"
import type { BoardItem, ClockboardSettings } from "~/lib/types"
import "~/styles/global.css"

const moveItem = (items: BoardItem[], id: string, direction: -1 | 1) => {
  const index = items.findIndex((item) => item.id === id)
  const nextIndex = index + direction

  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
    return items
  }

  const nextItems = [...items]
  const [item] = nextItems.splice(index, 1)
  if (!item) {
    return items
  }

  nextItems.splice(nextIndex, 0, item)
  return nextItems
}

export default function OptionsPage() {
  const now = useNow()
  const { state, isLoading, error, setItems, setSettings } =
    useClockboardState()

  const previewItems = useMemo(() => state?.items.slice(0, 4) ?? [], [state])

  if (isLoading) {
    return <LoadingView />
  }

  if (error || !state) {
    return <ErrorView message={error || "Unable to load Clockboard"} />
  }

  const updateSettings = (changes: Partial<ClockboardSettings>) => {
    void setSettings({
      ...state.settings,
      ...changes
    })
  }

  const addItem = (kind: "clock" | "countdown") => {
    void setItems([...state.items, createBoardItem(kind)])
  }

  const updateItem = (item: BoardItem) => {
    void setItems(
      state.items.map((current) => (current.id === item.id ? item : current))
    )
  }

  const deleteItem = (id: string) => {
    void setItems(state.items.filter((item) => item.id !== id))
  }

  const reorderItem = (id: string, direction: -1 | 1) => {
    void setItems(moveItem(state.items, id, direction))
  }

  return (
    <PageShell
      narrow
      actions={
        <>
          <button
            className="secondary-button"
            onClick={() => addItem("clock")}
            type="button">
            New clock
          </button>
          <button
            className="primary-button"
            onClick={() => addItem("countdown")}
            type="button">
            New countdown
          </button>
        </>
      }
      subtitle="Tune the board once, then let the new tab stay quiet and useful."
      title="Studio">
      <section className="settings-panel" aria-labelledby="settings-heading">
        <div className="section-heading">
          <p className="eyebrow">Appearance</p>
          <h2 id="settings-heading">Board system</h2>
        </div>

        <div className="form-grid form-grid--wide">
          <label>
            <span>Board title</span>
            <input
              onChange={(event) =>
                updateSettings({ boardTitle: event.currentTarget.value })
              }
              type="text"
              value={state.settings.boardTitle}
            />
          </label>

          <label>
            <span>Detail level</span>
            <select
              onChange={(event) =>
                updateSettings({
                  detailLevel: event.currentTarget
                    .value as ClockboardSettings["detailLevel"]
                })
              }
              value={state.settings.detailLevel}>
              <option value="minimal">Minimal</option>
              <option value="balanced">Balanced</option>
              <option value="rich">Rich</option>
            </select>
          </label>
        </div>

        <div className="control-group" aria-label="Board layout">
          <span>Layout</span>
          <div className="segmented-control">
            {(["focus", "grid", "compact"] as const).map((layout) => (
              <label key={layout}>
                <input
                  checked={state.settings.layout === layout}
                  name="layout"
                  onChange={() => updateSettings({ layout })}
                  type="radio"
                />
                <span>{layout}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="control-grid">
          <label className="switch-label">
            <input
              checked={state.settings.showDate}
              onChange={(event) =>
                updateSettings({ showDate: event.currentTarget.checked })
              }
              type="checkbox"
            />
            <span>Show clock dates</span>
          </label>

          <label>
            <span>Density</span>
            <select
              onChange={(event) =>
                updateSettings({
                  density: event.currentTarget
                    .value as ClockboardSettings["density"]
                })
              }
              value={state.settings.density}>
              <option value="comfortable">Comfortable</option>
              <option value="condensed">Condensed</option>
            </select>
          </label>

          <label>
            <span>Clock precision</span>
            <select
              onChange={(event) =>
                updateSettings({
                  clockPrecision: event.currentTarget
                    .value as ClockboardSettings["clockPrecision"]
                })
              }
              value={state.settings.clockPrecision}>
              <option value="minutes">Minutes</option>
              <option value="seconds">Seconds</option>
            </select>
          </label>
        </div>
      </section>

      <section className="settings-panel" aria-labelledby="preview-heading">
        <div className="section-heading">
          <p className="eyebrow">Live</p>
          <h2 id="preview-heading">Preview</h2>
        </div>
        <BoardList items={previewItems} now={now} settings={state.settings} />
      </section>

      <section className="editor-list" aria-label="Board item editors">
        <div className="section-heading">
          <p className="eyebrow">Content</p>
          <h2>Items</h2>
        </div>
        {state.items.map((item, index) => (
          <ItemEditor
            canMoveDown={index < state.items.length - 1}
            canMoveUp={index > 0}
            item={item}
            key={item.id}
            onChange={updateItem}
            onDelete={deleteItem}
            onMove={reorderItem}
          />
        ))}
      </section>
    </PageShell>
  )
}
