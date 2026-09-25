// UI tests for the student applications page and the navbar links per role.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt, mockFetch, fakeToken, jobs } from './helpers.jsx'

test('lists applications with the opening title and status', async () => {
  mockFetch([
    { path: '/api/applications', body: [
      { id: 'a1', jobId: 'job-1', status: 'reviewed', createdAt: '2026-09-03T00:00:00.000Z' },
      { id: 'a2', jobId: 'gone', status: 'submitted', createdAt: '2026-09-04T00:00:00.000Z' }
    ] },
    { path: '/api/jobs/job-1', body: jobs[0] },
    { path: '/api/jobs/gone', status: 404, body: { message: 'Opening does not exist' } }
  ])
  renderAt('/applications', { token: fakeToken('student', 'stu-1') })

  expect(await screen.findByRole('link', { name: 'Research assistant, vision lab' })).toHaveAttribute('href', '/jobs/job-1')
  expect(screen.getByText('reviewed')).toBeInTheDocument()
  expect(screen.getByText('Opening removed')).toBeInTheDocument()
})

test('shows the empty state and the navbar links for a student', async () => {
  mockFetch([{ path: '/api/applications', body: [] }])
  renderAt('/applications', { token: fakeToken('student', 'stu-1', 'Jordan') })

  expect(await screen.findByText('You have not applied to anything yet.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'My applications' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Post opening' })).not.toBeInTheDocument()
  expect(screen.getByText('Jordan · student')).toBeInTheDocument()
})

test('shows an error with retry when the list fails', async () => {
  mockFetch([{ path: '/api/applications', status: 500, body: { message: 'Something went wrong' } }])
  renderAt('/applications', { token: fakeToken('student', 'stu-1') })

  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})

test('log out clears the token and returns to login', async () => {
  mockFetch([{ path: '/api/applications', body: [] }])
  renderAt('/applications', { token: fakeToken('student', 'stu-1') })
  await screen.findByText('You have not applied to anything yet.')

  await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  expect(localStorage.getItem('campusworks_token')).toBeNull()
})
