// UI tests for the opening form: validation, create, edit with prefilled values, and a server error.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt, mockFetch, fakeToken, jobs } from './helpers.jsx'

test('shows validation messages when required fields are empty', async () => {
  const fetchMock = mockFetch([])
  renderAt('/jobs/new', { token: fakeToken('professor', 'prof-1') })

  await userEvent.type(screen.getByLabelText('Minimum GPA'), '5')
  await userEvent.click(screen.getByRole('button', { name: 'Post opening' }))

  expect(screen.getByText('Title is required')).toBeInTheDocument()
  expect(screen.getByText('Department is required')).toBeInTheDocument()
  expect(screen.getByText('Minimum GPA must be a number from 0 to 4')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('posts the opening and navigates to it', async () => {
  const fetchMock = mockFetch([
    { method: 'POST', path: '/api/jobs', status: 201, body: { ...jobs[0], id: 'job-9', title: 'New RA role' } },
    { path: '/api/jobs/job-9', body: { ...jobs[0], id: 'job-9', title: 'New RA role' } },
    { path: '/api/jobs/job-9/applications', body: [] }
  ])
  renderAt('/jobs/new', { token: fakeToken('professor', 'prof-1') })

  await userEvent.type(screen.getByLabelText('Title'), 'New RA role')
  await userEvent.type(screen.getByLabelText('Department'), 'Computer Science')
  await userEvent.selectOptions(screen.getByLabelText('Type'), 'TA')
  await userEvent.type(screen.getByLabelText('Minimum GPA'), '3.2')
  await userEvent.type(screen.getByLabelText('Hours per week'), '8')
  await userEvent.type(screen.getByLabelText('Skills, comma separated'), 'java, git')
  await userEvent.click(screen.getByRole('button', { name: 'Post opening' }))

  expect(await screen.findByRole('heading', { name: 'New RA role' })).toBeInTheDocument()
  const [, options] = fetchMock.mock.calls.find(([url, o]) => url === '/api/jobs' && o?.method === 'POST')
  expect(JSON.parse(options.body)).toMatchObject({ title: 'New RA role', department: 'Computer Science', type: 'TA', minGpa: 3.2, hoursPerWeek: 8, skills: ['java', 'git'] })
})

test('edit form is prefilled and sends a PUT', async () => {
  let current = jobs[0]
  const fetchMock = mockFetch([
    { path: '/api/jobs/job-1', body: () => current },
    { method: 'PUT', path: '/api/jobs/job-1', body: (o) => { current = { ...jobs[0], title: JSON.parse(o.body).title }; return current } },
    { path: '/api/jobs/job-1/applications', body: [] }
  ])
  renderAt('/jobs/job-1/edit', { token: fakeToken('professor', 'prof-1') })

  const title = await screen.findByLabelText('Title')
  expect(title).toHaveValue('Research assistant, vision lab')
  expect(screen.getByLabelText('Skills, comma separated')).toHaveValue('python')

  await userEvent.clear(title)
  await userEvent.type(title, 'Renamed')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('heading', { name: 'Renamed' })).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([url, o]) => url === '/api/jobs/job-1' && o?.method === 'PUT')).toBe(true)
})

test('shows the server error and keeps the form', async () => {
  mockFetch([{ method: 'POST', path: '/api/jobs', status: 403, body: { message: 'Requires professor role' } }])
  renderAt('/jobs/new', { token: fakeToken('professor', 'prof-1') })

  await userEvent.type(screen.getByLabelText('Title'), 'X')
  await userEvent.type(screen.getByLabelText('Department'), 'Y')
  await userEvent.click(screen.getByRole('button', { name: 'Post opening' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Requires professor role')
  expect(screen.getByLabelText('Title')).toHaveValue('X')
})
