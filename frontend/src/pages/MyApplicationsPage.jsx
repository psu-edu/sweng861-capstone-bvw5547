// A student's applications with the opening title and the current status.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import Spinner from '../components/Spinner.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'

export default function MyApplicationsPage() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  function load() {
    setRows(null)
    setError(null)
    api('/api/applications')
      .then((applications) => Promise.all(applications.map(async (a) => {
        const job = await api(`/api/jobs/${a.jobId}`).catch(() => null)
        return { ...a, job }
      })))
      .then(setRows)
      .catch((e) => setError(e.message))
  }

  useEffect(load, [])

  return (
    <div>
      <div className="page-head">
        <h1>My applications</h1>
        <Link to="/jobs" className="button primary">Browse openings</Link>
      </div>

      {error && <ErrorMessage message={error} onRetry={load} />}
      {!error && rows === null && <Spinner />}

      {rows !== null && rows.length === 0 && <p className="empty-state">You have not applied to anything yet.</p>}

      {rows !== null && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Opening</th>
                <th>Department</th>
                <th>Applied</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{a.job ? <Link to={`/jobs/${a.job.id}`}>{a.job.title}</Link> : 'Opening removed'}</td>
                  <td>{a.job?.department || ''}</td>
                  <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
