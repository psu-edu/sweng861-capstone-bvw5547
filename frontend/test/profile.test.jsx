// UI tests for the profile page: student and professor forms, validation, save, and the saved toast.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt, mockFetch, fakeToken } from './helpers.jsx'

test('student form loads existing values, validates, and saves', async () => {
  const fetchMock = mockFetch([
    { path: '/api/profiles/me', body: { userId: 'stu-1', major: 'Computer Science', gpa: 3.7, skills: ['python', 'sql'], resumeUrl: 'https://x.y/r.pdf' } },
    { method: 'PUT', path: '/api/profiles/me', body: {} }
  ])
  renderAt('/profile', { token: fakeToken('student', 'stu-1') })

  const gpa = await screen.findByLabelText('GPA')
  expect(gpa).toHaveValue(3.7)
  expect(screen.getByLabelText('Skills, comma separated')).toHaveValue('python, sql')

  await userEvent.clear(gpa)
  await userEvent.type(gpa, '4.5')
  await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
  expect(screen.getByText('GPA must be a number from 0 to 4')).toBeInTheDocument()

  await userEvent.clear(gpa)
  await userEvent.type(gpa, '3.9')
  await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.')
  const [, options] = fetchMock.mock.calls.find(([, o]) => o?.method === 'PUT')
  expect(JSON.parse(options.body)).toEqual({ major: 'Computer Science', gpa: 3.9, skills: ['python', 'sql'], resumeUrl: 'https://x.y/r.pdf' })
})

test('professor form asks for department and sends only professor fields', async () => {
  const fetchMock = mockFetch([
    { path: '/api/profiles/me', body: { userId: 'prof-1', skills: [] } },
    { method: 'PUT', path: '/api/profiles/me', body: {} }
  ])
  renderAt('/profile', { token: fakeToken('professor', 'prof-1') })

  await userEvent.click(await screen.findByRole('button', { name: 'Save profile' }))
  expect(screen.getByText('Department is required')).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Department'), 'Mathematics')
  await userEvent.type(screen.getByLabelText('Contact'), 'room 101')
  await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.')
  const [, options] = fetchMock.mock.calls.find(([, o]) => o?.method === 'PUT')
  expect(JSON.parse(options.body)).toEqual({ department: 'Mathematics', contact: 'room 101' })
})

test('shows the server error when the save fails', async () => {
  mockFetch([
    { path: '/api/profiles/me', body: { userId: 'stu-1', skills: [] } },
    { method: 'PUT', path: '/api/profiles/me', status: 400, body: { message: 'Resume must be an http or https link' } }
  ])
  renderAt('/profile', { token: fakeToken('student', 'stu-1') })

  await userEvent.type(await screen.findByLabelText('Major'), 'CS')
  await userEvent.type(screen.getByLabelText('GPA'), '3')
  await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Resume must be an http or https link')
})
