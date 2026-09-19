// Loading indicator used by every page while a fetch is running.
export default function Spinner() {
  return (
    <div className="spinner-wrap" role="status">
      <div className="spinner" aria-hidden="true" />
      <span>Loading...</span>
    </div>
  )
}
