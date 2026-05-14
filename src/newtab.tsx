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

export default function NewTabPage() {
  const now = useNow()
  const { state, isLoading, error } = useClockboardState()

  if (isLoading) {
    return <LoadingView />
  }

  if (error || !state) {
    return <ErrorView message={error || "Unable to load Clockboard"} />
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">New tab</p>
          <h1>{state.settings.boardTitle}</h1>
          <p className="page-header__subtitle">
            {new Intl.DateTimeFormat(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric"
            }).format(now)}
          </p>
        </div>
        <div className="page-header__actions">
          <button className="secondary-button" onClick={openOptions} type="button">
            Options
          </button>
        </div>
      </header>
      <BoardGrid items={state.items} now={now} settings={state.settings} />
    </main>
  )
}
