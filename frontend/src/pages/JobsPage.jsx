// Job board. Lists open positions with search and filters. With the mine flag a professor
// sees their own openings in every status.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'

const emptyFilters = { q: '', department: '', type: '', maxGpa: '' }

export default function JobsPage({ mine = false }) {
  const { user } = useAuth()
  const [filters, setFilters] = useState(emptyFilters)
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState(null)

  function load(current = filters) {
    setJobs(null)
    setError(null)
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(current)) {
      if (value) params.set(key, value)
    }
    if (mine) params.set('mine', 'true')
    api(`/api/jobs?${params}`)
      .then(setJobs)
      .catch((e) => setError(e.message))
  }

  useEffect(() => load(emptyFilters), [mine])

  function handleSearch(event) {
    event.preventDefault()
    load(filters)
  }

  function update(field) {
    return (event) => setFilters({ ...filters, [field]: event.target.value })
  }

  return (
    <div>
      <div className="page-head">
        <h1>{mine ? 'My openings' : 'Open positions'}</h1>
        {mine && <Link to="/jobs/new" className="button primary">Post opening</Link>}
      </div>

      {!mine && (
        <form className="filters" onSubmit={handleSearch} aria-label="Filter openings">
          <input type="search" placeholder="Search title or description" aria-label="Search" value={filters.q} onChange={update('q')} />
          <input type="text" placeholder="Department" aria-label="Department" value={filters.department} onChange={update('department')} />
          <select aria-label="Type" value={filters.type} onChange={update('type')}>
            <option value="">Any type</option>
            <option value="RA">RA</option>
            <option value="TA">TA</option>
          </select>
          <input type="number" step="0.1" min="0" max="4" placeholder="My GPA" aria-label="My GPA" value={filters.maxGpa} onChange={update('maxGpa')} />
          <button type="submit" className="button primary">Search</button>
        </form>
      )}

      {error && <ErrorMessage message={error} onRetry={() => load(filters)} />}
      {!error && jobs === null && <Spinner />}

      {jobs !== null && jobs.length === 0 && (
        <p className="empty-state">{mine ? 'You have not posted any openings yet.' : 'No openings match. Try fewer filters.'}</p>
      )}

      {jobs !== null && jobs.length > 0 && (
        <ul className="card-grid">
          {jobs.map((job) => (
            <li key={job.id} className="card">
              <h2>{job.title}</h2>
              <p>
                <span className={`badge badge-${job.type}`}>{job.type}</span>{' '}
                <span className={`badge badge-${job.status}`}>{job.status}</span>
              </p>
              <p className="muted">{job.department} · Posted by {job.professorId === user.id ? 'you' : job.professorName}</p>
              <p className="muted">Min GPA {job.minGpa.toFixed(2)}{job.hoursPerWeek ? ` · ${job.hoursPerWeek} hrs/week` : ''}{job.pay ? ` · ${job.pay}` : ''}</p>
              <Link to={`/jobs/${job.id}`} className="button">View details</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
