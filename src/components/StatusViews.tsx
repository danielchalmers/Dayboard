export const LoadingView = () => (
  <div className="status-view" role="status">
    Loading Clockboard
  </div>
)

export const ErrorView = ({ message }: { message: string }) => (
  <div className="status-view status-view--error" role="alert">
    {message}
  </div>
)
