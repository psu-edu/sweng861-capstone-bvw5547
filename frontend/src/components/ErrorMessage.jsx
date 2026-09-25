// Error box for failed loads. Shows a message and an optional retry button.
export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="error-box" role="alert">
      <p>{message || 'Could not load data.'}</p>
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
