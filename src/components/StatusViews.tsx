export const ErrorView = ({ message }: { message: string }) => (
  <div className="status-view status-view--error" role="alert">
    <div className="status-view__error-badge" aria-hidden="true">
      !
    </div>
    <span className="status-view__message">{message}</span>
  </div>
)
