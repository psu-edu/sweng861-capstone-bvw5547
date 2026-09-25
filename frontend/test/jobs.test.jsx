// UI tests for the job board: loading, list, filters sent to the api, empty state, error with retry, and my openings.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt, mockFetch, fakeToken, jsonResponse, jobs } from './helpers.jsx'

test('shows the spinner then the openings with type, status, and gpa', async () => {
  mockFetch([{ path: /^\/api\/jobs\?/, body: jobs }])
  renderAt('/jobs', { token: fakeToken('student') })

  expect(screen.getByRole('status')).toHaveTextContent('Loading...')
  expect(await screen.findByText('Research assistant, vision lab')).toBeInTheDocument()
  expect(screen.getByText('TA for calculus')).toBeInTheDocument()
  expect(screen.getByText(/Min GPA 3.50 · 10 hrs\/week · \$16\/hr/)).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'View details' })).toHaveLength(2)
  expect(screen.getAllByText(/Posted by Dr. Maria Chen/)).toHaveLength(2)
})

test('sends the filters as query parameters', async () => {
  const fetchMock = mockFetch([{ path: /^\/api\/jobs\?/, body: jobs }])
  renderAt('/jobs', { token: fakeToken('student') })
  await screen.findByText('TA for calculus')

  await userEvent.type(screen.getByLabelText('Search'), 'vision')
  await userEvent.type(screen.getByLabelText('Department'), 'Computer')
  await userEvent.selectOptions(screen.getByLabelText('Type'), 'RA')
  await userEvent.type(screen.getByLabelText('My GPA'), '3.7')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))

  await screen.findByText('TA for calculus')
  const last = fetchMock.mock.calls.at(-1)[0]
  expect(last).toBe('/api/jobs?q=vision&department=Computer&type=RA&maxGpa=3.7')
})

test('shows the empty state when nothing matches', async () => {
  mockFetch([{ path: /^\/api\/jobs\?/, body: [] }])
  renderAt('/jobs', { token: fakeToken('student') })

  expect(await screen.findByText('No openings match. Try fewer filters.')).toBeInTheDocument()
})

test('shows an error with retry and recovers', async () => {
  global.fetch = vi.fn()
    .mockResolvedValueOnce(jsonResponse(500, { message: 'Something went wrong' }))
    .mockResolvedValueOnce(jsonResponse(200, jobs))
  renderAt('/jobs', { token: fakeToken('student') })

  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

  expect(await screen.findByText('TA for calculus')).toBeInTheDocument()
})

test('my openings asks for mine and shows the post button', async () => {
  const fetchMock = mockFetch([{ path: /^\/api\/jobs\?/, body: [{ ...jobs[0], status: 'closed' }] }])
  renderAt('/my-openings', { token: fakeToken('professor', 'prof-1') })

  expect(await screen.findByRole('heading', { name: 'My openings' })).toBeInTheDocument()
  expect(screen.getByText('closed')).toBeInTheDocument()
  expect(screen.getByText(/Posted by you/)).toBeInTheDocument()
  const links = screen.getAllByRole('link', { name: 'Post opening' })
  expect(links).toHaveLength(2)
  expect(links.every((link) => link.getAttribute('href') === '/jobs/new')).toBe(true)
  expect(fetchMock.mock.calls[0][0]).toBe('/api/jobs?mine=true')
})
