// Create or edit an opening. With an id in the route the form loads the opening first.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import Spinner from '../components/Spinner.jsx'

const empty = { title: '', department: '', type: 'RA', hoursPerWeek: '', pay: '', minGpa: '', skills: '', description: '' }

export default function JobFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(Boolean(id))
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    api(`/api/jobs/${id}`)
      .then((job) => {
        setForm({
          title: job.title,
          department: job.department,
          type: job.type,
          hoursPerWeek: job.hoursPerWeek ?? '',
          pay: job.pay ?? '',
          minGpa: job.minGpa,
          skills: job.skills.join(', '),
          description: job.description
        })
        setLoading(false)
      })
      .catch((e) => {
        setServerError(e.message)
        setLoading(false)
      })
  }, [id])

  function update(field) {
    return (event) => setForm({ ...form, [field]: event.target.value })
  }

  function validate() {
    const errors = {}
    if (!form.title.trim()) errors.title = 'Title is required'
    if (!form.department.trim()) errors.department = 'Department is required'
    const gpa = form.minGpa === '' ? 0 : Number(form.minGpa)
    if (Number.isNaN(gpa) || gpa < 0 || gpa > 4) errors.minGpa = 'Minimum GPA must be a number from 0 to 4'
    return errors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setServerError(null)
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    const body = {
      title: form.title.trim(),
      department: form.department.trim(),
      type: form.type,
      hoursPerWeek: form.hoursPerWeek === '' ? null : Number(form.hoursPerWeek),
      pay: form.pay.trim(),
      minGpa: form.minGpa === '' ? 0 : Number(form.minGpa),
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      description: form.description.trim()
    }
    try {
      const job = id
        ? await api(`/api/jobs/${id}`, { method: 'PUT', body })
        : await api('/api/jobs', { method: 'POST', body })
      navigate(`/jobs/${job.id}`)
    } catch (error) {
      setServerError(error.message)
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="auth-card wide">
      <h1>{id ? 'Edit opening' : 'Post an opening'}</h1>

      {serverError && <div className="error-box" role="alert">{serverError}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="title">Title</label>
        <input id="title" type="text" value={form.title} onChange={update('title')} />
        {fieldErrors.title && <p className="field-error">{fieldErrors.title}</p>}

        <label htmlFor="department">Department</label>
        <input id="department" type="text" value={form.department} onChange={update('department')} />
        {fieldErrors.department && <p className="field-error">{fieldErrors.department}</p>}

        <label htmlFor="type">Type</label>
        <select id="type" value={form.type} onChange={update('type')}>
          <option value="RA">Research assistant</option>
          <option value="TA">Teaching assistant</option>
        </select>

        <label htmlFor="minGpa">Minimum GPA</label>
        <input id="minGpa" type="number" step="0.1" min="0" max="4" value={form.minGpa} onChange={update('minGpa')} />
        {fieldErrors.minGpa && <p className="field-error">{fieldErrors.minGpa}</p>}

        <label htmlFor="hoursPerWeek">Hours per week</label>
        <input id="hoursPerWeek" type="number" min="1" max="40" value={form.hoursPerWeek} onChange={update('hoursPerWeek')} />

        <label htmlFor="pay">Pay</label>
        <input id="pay" type="text" value={form.pay} onChange={update('pay')} placeholder="$15/hr" />

        <label htmlFor="skills">Skills, comma separated</label>
        <input id="skills" type="text" value={form.skills} onChange={update('skills')} placeholder="python, sql" />

        <label htmlFor="description">Description</label>
        <textarea id="description" rows="5" value={form.description} onChange={update('description')} />

        <div className="form-actions">
          <button type="submit" className="button primary" disabled={saving}>{saving ? 'Saving...' : id ? 'Save changes' : 'Post opening'}</button>
          <Link to={id ? `/jobs/${id}` : '/my-openings'} className="button secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
