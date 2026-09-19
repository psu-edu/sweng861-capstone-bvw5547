// UI tests for the opening page: student apply with the GPA result, the applied state, and the professor
// owner view with applicants, status actions, share, and close.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt, mockFetch, fakeToken, jobs } from './helpers.jsx'

const job = jobs[0]
const application = { id: 'app-1', jobId: 'job-1', studentId: 'stu-1', status: 'submitted', gpaAtApply: 3.7, resumeUrl: 'https://x.y/r.pdf', createdAt: '2026-09-03T00:00:00.000Z' }

test('student below the bar sees the reason from the api', async () => {
  mockFetch([
    { path: '/api/jobs/job-1', body: job },
    { path: '/api/applications', body: [] },
    { method: 'POST', path: '/api/applications', status: 422, body: { message: 'This opening requires a GPA of 3.50 or higher' } }
  ])
  renderAt('/jobs/job-1', { token: fakeToken('student', 'stu-2') })
  await screen.findByRole('heading', { name: job.title })

  await userEvent.click(screen.getByRole('button', { name: 'Apply to this opening' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('This opening requires a GPA of 3.50 or higher')
})

test('eligible student applies and sees the submitted status', async () => {
  const fetchMock = mockFetch([
    { path: '/api/jobs/job-1', body: job },
    { path: '/api/applications', body: [] },
    { method: 'POST', path: '/api/applications', status: 201, body: application }
  ])
  renderAt('/jobs/job-1', { token: fakeToken('student', 'stu-1') })
  await screen.findByRole('heading', { name: job.title })

  await userEvent.click(screen.getByRole('button', { name: 'Apply to this opening' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Application submitted.')
  expect(screen.getByText('submitted')).toBeInTheDocument()
  const [, options] = fetchMock.mock.calls.find(([, o]) => o?.method === 'POST')
  expect(JSON.parse(options.body)).toEqual({ jobId: 'job-1' })
})

test('student who already applied sees the status instead of the button', async () => {
  mockFetch([
    { path: '/api/jobs/job-1', body: job },
    { path: '/api/applications', body: [{ ...application, status: 'accepted' }] }
  ])
  renderAt('/jobs/job-1', { token: fakeToken('student', 'stu-1') })

  expect(await screen.findByText('accepted')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Apply to this opening' })).not.toBeInTheDocument()
})

test('missing opening shows the not found message', async () => {
  mockFetch([{ path: '/api/jobs/nope', status: 404, body: { message: 'Opening does not exist' } }])
  renderAt('/jobs/nope', { token: fakeToken('student') })

  expect(await screen.findByRole('alert')).toHaveTextContent('This opening does not exist or has been removed.')
})

test('owner reviews an applicant, views the profile, shares, and closes', async () => {
  const fetchMock = mockFetch([
    { path: '/api/jobs/job-1', body: job },
    { path: '/api/jobs/job-1/applications', body: [application] },
    { path: '/api/profiles/stu-1', body: { major: 'Computer Science', gpa: 3.7, skills: ['python', 'sql'] } },
    { method: 'PATCH', path: '/api/applications/app-1/status', body: (o) => ({ ...application, status: JSON.parse(o.body).status }) },
    { method: 'POST', path: '/api/jobs/job-1/share', body: { postId: 'urn:li:share:9' } },
    { method: 'POST', path: '/api/jobs/job-1/close', body: { ...job, status: 'closed' } }
  ])
  renderAt('/jobs/job-1', { token: fakeToken('professor', 'prof-1') })
  await screen.findByRole('heading', { name: 'Applicants' })
  const row = (await screen.findByText('3.70')).closest('tr')

  await userEvent.click(within(row).getByRole('button', { name: 'View profile' }))
  expect(await within(row).findByText('Computer Science')).toBeInTheDocument()

  await userEvent.click(within(row).getByRole('button', { name: 'Mark reviewed' }))
  expect(await within(row).findByText('reviewed')).toBeInTheDocument()

  await userEvent.click(within(row).getByRole('button', { name: 'Accept' }))
  expect(await within(row).findByText('accepted')).toBeInTheDocument()
  expect(within(row).queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Share on LinkedIn' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Shared on LinkedIn. Post id urn:li:share:9')

  await userEvent.click(screen.getByRole('button', { name: 'Close opening' }))
  expect(await screen.findByText('closed')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Close opening' })).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([url, o]) => url === '/api/jobs/job-1/close' && o.method === 'POST')).toBe(true)
})

test('share without a LinkedIn login shows the conflict message', async () => {
  mockFetch([
    { path: '/api/jobs/job-1', body: job },
    { path: '/api/jobs/job-1/applications', body: [] },
    { method: 'POST', path: '/api/jobs/job-1/share', status: 409, body: { message: 'Sign in with LinkedIn as a professor to share openings' } }
  ])
  renderAt('/jobs/job-1', { token: fakeToken('professor', 'prof-1') })
  await screen.findByText('No applications yet.')

  await userEvent.click(screen.getByRole('button', { name: 'Share on LinkedIn' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Sign in with LinkedIn as a professor to share openings')
})

test('another professor sees no owner controls', async () => {
  mockFetch([{ path: '/api/jobs/job-1', body: job }])
  renderAt('/jobs/job-1', { token: fakeToken('professor', 'prof-2') })
  await screen.findByRole('heading', { name: job.title })

  expect(screen.queryByRole('button', { name: 'Close opening' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Applicants' })).not.toBeInTheDocument()
})
