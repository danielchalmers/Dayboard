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

  const updateSettings = (settings: ClockboardSettings) => {
    void setSettings(settings)
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
      subtitle="Keep the moments you care about close, without fussing over display settings."
      title="Design your board">
      <section className="settings-panel" aria-labelledby="settings-heading">
        <h2 id="settings-heading">Board</h2>
        <div className="form-grid">
          <label>
            <span>Title</span>
            <input
              onChange={(event) =>
                updateSettings({
                  ...state.settings,
                  boardTitle: event.currentTarget.value
                })
              }
              type="text"
              value={state.settings.boardTitle}
            />
          </label>
          <label className="checkbox-label">
            <input
              checked={state.settings.showDate}
              onChange={(event) =>
                updateSettings({
                  ...state.settings,
                  showDate: event.currentTarget.checked
                })
              }
              type="checkbox"
            />
            <span>Show dates under clocks</span>
          </label>
        </div>
      </section>

      <section className="settings-panel" aria-labelledby="preview-heading">
        <h2 id="preview-heading">Preview</h2>
        <BoardList items={previewItems} now={now} settings={state.settings} />
      </section>

      <section className="editor-list" aria-label="Board item editors">
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
