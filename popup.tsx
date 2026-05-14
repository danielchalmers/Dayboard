import { BoardGrid } from "~/components/BoardGrid"
import { ErrorView, LoadingView } from "~/components/StatusViews"
import { useClockboardState } from "~/hooks/useClockboardState"
import { useNow } from "~/hooks/useNow"
import "~/styles/global.css"

const openOptions = () => {
  if (chrome.runtime?.openOptionsPage) {
    void chrome.runtime.openOptionsPage()
  }
}

const openNewTab = () => {
  const url = chrome.runtime?.getURL("newtab.html")

  if (url) {
    void chrome.tabs?.create({ url })
  }
}

export default function PopupPage() {
  const now = useNow()
  const { state, isLoading, error } = useClockboardState()

  return (
    <div className="popup-body">
      <main className="popup-page">
        <header className="popup-header">
          <div>
            <p className="eyebrow">Clockboard</p>
            <h1>At a glance</h1>
          </div>
        </header>

        {isLoading ? <LoadingView /> : null}
        {error ? <ErrorView message={error} /> : null}
        {state ? (
          <>
            <BoardGrid
              compact
              items={state.items.slice(0, 3)}
              now={now}
              settings={state.settings}
            />
            <div className="popup-actions">
              <button className="secondary-button" onClick={openNewTab} type="button">
                New tab
              </button>
              <button className="primary-button" onClick={openOptions} type="button">
                Options
              </button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
