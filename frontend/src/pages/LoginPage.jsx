// Login page. One form for login and registration, plus LinkedIn sign in for each role.
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

export default function LoginPage() {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'student' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/jobs" replace />

  function update(field) {
    return (event) => setForm({ ...form, [field]: event.target.value })
  }

  function validate() {
    const errors = {}
    if (!form.email.trim()) errors.email = 'Email is required'
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address'
    if (!form.password) errors.password = 'Password is required'
    else if (mode === 'register' && form.password.length < 8) errors.password = 'Password must be at least 8 characters'
    if (mode === 'register' && !form.name.trim()) errors.name = 'Name is required'
    return errors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setServerError(null)
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password)
      } else {
        await register({ email: form.email.trim(), password: form.password, name: form.name.trim(), role: form.role })
      }
      navigate('/jobs')
    } catch (error) {
      setServerError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>{mode === 'login' ? 'Log in' : 'Create account'}</h1>

      {serverError && <div className="error-box" role="alert">{serverError}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={form.email} onChange={update('email')} autoComplete="email" />
        {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}

        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={form.password} onChange={update('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}

        {mode === 'register' && (
          <>
            <label htmlFor="name">Name</label>
            <input id="name" type="text" value={form.name} onChange={update('name')} autoComplete="name" />
            {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}

            <label htmlFor="role">I am a</label>
            <select id="role" value={form.role} onChange={update('role')}>
              <option value="student">Student</option>
              <option value="professor">Professor</option>
            </select>
          </>
        )}

        <button type="submit" className="button primary full-width" disabled={submitting}>
          {submitting ? 'Saving...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>

      <div className="divider">or</div>

      <a className="button linkedin full-width" href="/auth/linkedin?role=student">Continue with LinkedIn as a student</a>
      <a className="button linkedin full-width" href="/auth/linkedin?role=professor">Continue with LinkedIn as a professor</a>

      <button
        type="button"
        className="link-button switch-mode"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login')
          setFieldErrors({})
          setServerError(null)
        }}
      >
        {mode === 'login' ? 'No account yet? Create one' : 'Already have an account? Log in'}
      </button>
    </div>
  )
}
