// Profile form. Students fill major, GPA, skills, and a resume link. Professors fill department and contact.
import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import Spinner from '../components/Spinner.jsx'

export default function ProfilePage() {
  const { user } = useAuth()
  const [form, setForm] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/api/profiles/me')
      .then((p) => setForm({
        major: p.major ?? '',
        gpa: p.gpa ?? '',
        skills: (p.skills || []).join(', '),
        resumeUrl: p.resumeUrl ?? '',
        department: p.department ?? '',
        contact: p.contact ?? ''
      }))
      .catch((e) => setServerError(e.message))
  }, [])

  function update(field) {
    return (event) => {
      setSaved(false)
      setForm({ ...form, [field]: event.target.value })
    }
  }

  function validate() {
    const errors = {}
    if (user.role === 'student') {
      if (!form.major.trim()) errors.major = 'Major is required'
      const gpa = Number(form.gpa)
      if (form.gpa === '' || Number.isNaN(gpa) || gpa < 0 || gpa > 4) errors.gpa = 'GPA must be a number from 0 to 4'
      if (form.resumeUrl && !/^https?:\/\/\S+$/i.test(form.resumeUrl.trim())) errors.resumeUrl = 'Resume must be an http or https link'
    } else if (!form.department.trim()) {
      errors.department = 'Department is required'
    }
    return errors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setServerError(null)
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    const body = user.role === 'student'
      ? { major: form.major.trim(), gpa: Number(form.gpa), skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean), resumeUrl: form.resumeUrl.trim() }
      : { department: form.department.trim(), contact: form.contact.trim() }
    try {
      await api('/api/profiles/me', { method: 'PUT', body })
      setSaved(true)
    } catch (error) {
      setServerError(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (!form && !serverError) return <Spinner />

  return (
    <div className="auth-card">
      <h1>My profile</h1>
      <p className="muted">{user.name} · {user.role}</p>

      {serverError && <div className="error-box" role="alert">{serverError}</div>}
      {saved && <div className="toast" role="status">Profile saved.</div>}

      {form && (
        <form onSubmit={handleSubmit} noValidate>
          {user.role === 'student' ? (
            <>
              <label htmlFor="major">Major</label>
              <input id="major" type="text" value={form.major} onChange={update('major')} />
              {fieldErrors.major && <p className="field-error">{fieldErrors.major}</p>}

              <label htmlFor="gpa">GPA</label>
              <input id="gpa" type="number" step="0.01" min="0" max="4" value={form.gpa} onChange={update('gpa')} />
              {fieldErrors.gpa && <p className="field-error">{fieldErrors.gpa}</p>}

              <label htmlFor="skills">Skills, comma separated</label>
              <input id="skills" type="text" value={form.skills} onChange={update('skills')} />

              <label htmlFor="resumeUrl">Resume link</label>
              <input id="resumeUrl" type="url" value={form.resumeUrl} onChange={update('resumeUrl')} placeholder="https://" />
              {fieldErrors.resumeUrl && <p className="field-error">{fieldErrors.resumeUrl}</p>}
            </>
          ) : (
            <>
              <label htmlFor="department">Department</label>
              <input id="department" type="text" value={form.department} onChange={update('department')} />
              {fieldErrors.department && <p className="field-error">{fieldErrors.department}</p>}

              <label htmlFor="contact">Contact</label>
              <input id="contact" type="text" value={form.contact} onChange={update('contact')} placeholder="Email or office" />
            </>
          )}

          <button type="submit" className="button primary full-width" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
        </form>
      )}
    </div>
  )
}
