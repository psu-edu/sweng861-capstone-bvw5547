// One opening. Students see the details and an apply button with the eligibility result.
// The owning professor sees edit, close, share on LinkedIn, and the applicant list with status actions.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'

export default function JobDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const [myApplication, setMyApplication] = useState(null)
  const [applicants, setApplicants] = useState(null)
  const [profiles, setProfiles] = useState({})
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const isOwner = user.role === 'professor' && job && job.professorId === user.id

  function load() {
    setJob(null)
    setError(null)
    api(`/api/jobs/${id}`)
      .then((data) => {
        setJob(data)
        if (user.role === 'student') {
          return api('/api/applications').then((list) => setMyApplication(list.find((a) => a.jobId === data.id) || null))
        }
        if (data.professorId === user.id) {
          return api(`/api/jobs/${data.id}/applications`).then(setApplicants)
        }
        return null
      })
      .catch((e) => setError(e))
  }

  useEffect(load, [id])

  async function act(fn, successMessage) {
    setBusy(true)
    setNotice(null)
    try {
      await fn()
      if (successMessage) setNotice({ kind: 'ok', text: successMessage })
    } catch (e) {
      setNotice({ kind: 'error', text: e.message })
    } finally {
      setBusy(false)
    }
  }

  function apply() {
    return act(async () => {
      const application = await api('/api/applications', { method: 'POST', body: { jobId: job.id } })
      setMyApplication(application)
    }, 'Application submitted.')
  }

  function close() {
    return act(async () => setJob(await api(`/api/jobs/${job.id}/close`, { method: 'POST' })), 'Opening closed.')
  }

  function share() {
    return act(async () => {
      const result = await api(`/api/jobs/${job.id}/share`, { method: 'POST' })
      setNotice({ kind: 'ok', text: `Shared on LinkedIn. Post id ${result.postId}` })
    })
  }

  function setStatus(application, status) {
    return act(async () => {
      const updated = await api(`/api/applications/${application.id}/status`, { method: 'PATCH', body: { status } })
      setApplicants(applicants.map((a) => (a.id === updated.id ? updated : a)))
    })
  }

  function showProfile(studentId) {
    return act(async () => {
      const profile = await api(`/api/profiles/${studentId}`)
      setProfiles({ ...profiles, [studentId]: profile })
    })
  }

  function errorText() {
    if (error.status === 404) return 'This opening does not exist or has been removed.'
    return error.message
  }

  return (
    <div>
      <p><Link to={user.role === 'professor' ? '/my-openings' : '/jobs'}>&larr; Back to openings</Link></p>

      {error && <ErrorMessage message={errorText()} onRetry={error.status === 404 ? null : load} />}
      {!error && job === null && <Spinner />}

      {job && (
        <>
          <div className="page-head">
            <h1>{job.title}</h1>
            {isOwner && job.status === 'open' && (
              <div className="form-actions">
                <Link to={`/jobs/${job.id}/edit`} className="button">Edit</Link>
                <button type="button" className="button" onClick={share} disabled={busy}>Share on LinkedIn</button>
                <button type="button" className="button danger" onClick={close} disabled={busy}>Close opening</button>
              </div>
            )}
          </div>

          <p>
            <span className={`badge badge-${job.type}`}>{job.type}</span>{' '}
            <span className={`badge badge-${job.status}`}>{job.status}</span>
          </p>
          <p className="muted">
            {job.department} · Min GPA {job.minGpa.toFixed(2)}
            {job.hoursPerWeek ? ` · ${job.hoursPerWeek} hrs/week` : ''}
            {job.pay ? ` · ${job.pay}` : ''}
          </p>
          {job.skills.length > 0 && <p className="muted">Skills: {job.skills.join(', ')}</p>}
          <p>{job.description}</p>

          {notice && (
            <div className={notice.kind === 'ok' ? 'toast' : 'error-box'} role={notice.kind === 'ok' ? 'status' : 'alert'}>
              {notice.text}
            </div>
          )}

          {user.role === 'student' && (
            <section className="search-section">
              <h2>Apply</h2>
              {myApplication ? (
                <p>You applied on {new Date(myApplication.createdAt).toLocaleDateString()}. Status: <span className={`badge badge-${myApplication.status}`}>{myApplication.status}</span></p>
              ) : (
                <button type="button" className="button primary" onClick={apply} disabled={busy || job.status !== 'open'}>
                  {job.status === 'open' ? 'Apply to this opening' : 'Opening is closed'}
                </button>
              )}
            </section>
          )}

          {isOwner && (
            <section className="search-section">
              <h2>Applicants</h2>
              {applicants === null && <Spinner />}
              {applicants && applicants.length === 0 && <p className="empty-state">No applications yet.</p>}
              {applicants && applicants.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>GPA</th>
                        <th>Resume</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicants.map((a) => {
                        const profile = profiles[a.studentId]
                        return (
                          <tr key={a.id}>
                            <td>
                              {profile ? (
                                <>{profile.major}<br /><span className="muted">{profile.skills.join(', ')}</span></>
                              ) : (
                                <button type="button" className="link-button" onClick={() => showProfile(a.studentId)} disabled={busy}>View profile</button>
                              )}
                            </td>
                            <td>{a.gpaAtApply.toFixed(2)}</td>
                            <td><a href={a.resumeUrl} target="_blank" rel="noreferrer">Resume</a></td>
                            <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                            <td>
                              {a.status === 'submitted' && <button type="button" className="button small" onClick={() => setStatus(a, 'reviewed')} disabled={busy}>Mark reviewed</button>}{' '}
                              {(a.status === 'submitted' || a.status === 'reviewed') && (
                                <>
                                  <button type="button" className="button small" onClick={() => setStatus(a, 'accepted')} disabled={busy}>Accept</button>{' '}
                                  <button type="button" className="button danger small" onClick={() => setStatus(a, 'rejected')} disabled={busy}>Reject</button>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
