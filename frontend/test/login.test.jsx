// UI tests for the login page: validation, server errors, login, registration with a role, and route guard.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt, mockFetch, fakeToken, jobs } from './helpers.jsx'

test('shows validation messages on an empty submit', async () => {
  mockFetch([])
  renderAt('/login')

  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

  expect(screen.getByText('Email is required')).toBeInTheDocument()
  expect(screen.getByText('Password is required')).toBeInTheDocument()
})

test('shows the server message on a wrong password', async () => {
  mockFetch([{ method: 'POST', path: '/auth/login', status: 401, body: { message: 'Invalid email or password' } }])
  renderAt('/login')

  await userEvent.type(screen.getByLabelText('Email'), 'x@psu.edu')
  await userEvent.type(screen.getByLabelText('Password'), 'wrongpass')
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
})

test('logs in and lands on the openings page', async () => {
  mockFetch([
    { method: 'POST', path: '/auth/login', body: { token: fakeToken('student'), user: {} } },
    { path: /^\/api\/jobs\?/, body: jobs }
  ])
  renderAt('/login')

  await userEvent.type(screen.getByLabelText('Email'), 'student@psu.edu')
  await userEvent.type(screen.getByLabelText('Password'), 'Password123')
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

  expect(await screen.findByRole('heading', { name: 'Open positions' })).toBeInTheDocument()
  expect(await screen.findByText('Research assistant, vision lab')).toBeInTheDocument()
})

test('registers a professor with the role field and sends it to the api', async () => {
  const fetchMock = mockFetch([
    { method: 'POST', path: '/auth/register', status: 201, body: { token: fakeToken('professor', 'prof-1', 'Dr. Chen'), user: {} } },
    { path: /^\/api\/jobs\?/, body: jobs }
  ])
  renderAt('/login')

  await userEvent.click(screen.getByRole('button', { name: 'No account yet? Create one' }))
  await userEvent.type(screen.getByLabelText('Email'), 'prof@psu.edu')
  await userEvent.type(screen.getByLabelText('Password'), 'Password123')
  await userEvent.type(screen.getByLabelText('Name'), 'Dr. Chen')
  await userEvent.selectOptions(screen.getByLabelText('I am a'), 'professor')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByRole('heading', { name: 'Open positions' })).toBeInTheDocument()
  expect(screen.getByText('Dr. Chen · professor')).toBeInTheDocument()
  const [, options] = fetchMock.mock.calls.find(([url]) => url === '/auth/register')
  expect(JSON.parse(options.body)).toEqual({ email: 'prof@psu.edu', password: 'Password123', name: 'Dr. Chen', role: 'professor' })
})

test('offers LinkedIn sign in for both roles', () => {
  mockFetch([])
  renderAt('/login')

  expect(screen.getByRole('link', { name: 'Continue with LinkedIn as a student' })).toHaveAttribute('href', '/auth/linkedin?role=student')
  expect(screen.getByRole('link', { name: 'Continue with LinkedIn as a professor' })).toHaveAttribute('href', '/auth/linkedin?role=professor')
})

test('protected route redirects to login without a token and clears an expired one', async () => {
  mockFetch([{ path: /^\/api\/jobs\?/, status: 401, body: { message: 'Valid login is required' } }])
  renderAt('/jobs')
  expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()

  renderAt('/jobs', { token: fakeToken('student') })

  expect(await screen.findAllByRole('heading', { name: 'Log in' })).not.toHaveLength(0)
  expect(localStorage.getItem('campusworks_token')).toBeNull()
})
