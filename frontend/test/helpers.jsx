// Shared helpers for the UI tests. Renders the app at a route with a fake token and a mocked fetch.
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'

export function fakeToken(role = 'student', id = 'user-1', name = 'Test User') {
  const payload = btoa(JSON.stringify({ sub: id, role, name }))
  return `header.${payload}.signature`
}

export function jsonResponse(status, body) {
  return { ok: status < 400, status, json: async () => body }
}

export function mockFetch(routes) {
  const fn = vi.fn(async (url, options = {}) => {
    const method = options.method || 'GET'
    const match = routes.find((route) => {
      const sameMethod = (route.method || 'GET') === method
      const samePath = typeof route.path === 'string' ? route.path === url : route.path.test(url)
      return sameMethod && samePath
    })
    if (!match) return jsonResponse(404, { message: `No mock for ${method} ${url}` })
    const body = typeof match.body === 'function' ? match.body(options) : match.body
    return jsonResponse(match.status || 200, body)
  })
  global.fetch = fn
  return fn
}

export function renderAt(path, { token } = {}) {
  if (token) localStorage.setItem('campusworks_token', token)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
}

export const jobs = [
  { id: 'job-1', professorId: 'prof-1', title: 'Research assistant, vision lab', department: 'Computer Science', type: 'RA', hoursPerWeek: 10, pay: '$16/hr', minGpa: 3.5, skills: ['python'], description: 'Label data.', status: 'open', createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'job-2', professorId: 'prof-1', title: 'TA for calculus', department: 'Mathematics', type: 'TA', hoursPerWeek: null, pay: null, minGpa: 2.5, skills: [], description: 'Lead recitation.', status: 'open', createdAt: '2026-09-02T00:00:00.000Z' }
]
