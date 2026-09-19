// Integration tests for the LinkedIn sign in flow with the LinkedIn client mocked. Covers state checks,
// account creation, account linking, and the share endpoint once a token is stored.
jest.mock('../../backend/services/linkedin', () => ({
  isConfigured: () => true,
  authorizationUrl: (state, role) => `https://linkedin.example/auth?state=${state}&role=${role}`,
  exchangeCode: jest.fn(),
  getUserInfo: jest.fn(),
  shareOpening: jest.fn()
}));
const linkedin = require('../../backend/services/linkedin');
const { app, request, startDatabase, stopDatabase, registerUser, bearer, jobBody } = require('./helpers');

beforeAll(startDatabase);
afterAll(stopDatabase);

beforeEach(() => {
  linkedin.exchangeCode.mockResolvedValue({ accessToken: 'li-token', expiresIn: 3600, scope: 'openid' });
  linkedin.getUserInfo.mockResolvedValue({ id: 'li-123', name: 'Prof Link', email: 'link@psu.edu' });
  linkedin.shareOpening.mockResolvedValue('urn:li:share:1');
});

function stateFrom(res) {
  const cookie = res.headers['set-cookie'].find((c) => c.startsWith('linkedin_state='));
  const value = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
  return { cookie, state: value.split(':')[0] };
}

test('start sets a state cookie and redirects to LinkedIn with the role scopes', async () => {
  const res = await request(app).get('/auth/linkedin?role=professor');

  expect(res.status).toBe(302);
  expect(res.headers.location).toContain('role=professor');
  expect(stateFrom(res).state).toHaveLength(36);
});

test('callback rejects a missing or mismatched state', async () => {
  const start = await request(app).get('/auth/linkedin');

  const noCookie = await request(app).get('/auth/linkedin/callback?code=c&state=x');
  const wrong = await request(app).get('/auth/linkedin/callback?code=c&state=wrong').set('Cookie', stateFrom(start).cookie);

  expect(noCookie.status).toBe(400);
  expect(wrong.status).toBe(400);
  expect(linkedin.exchangeCode).not.toHaveBeenCalled();
});

test('callback creates a professor account and redirects with a token', async () => {
  const start = await request(app).get('/auth/linkedin?role=professor');
  const { cookie, state } = stateFrom(start);

  const res = await request(app).get(`/auth/linkedin/callback?code=c&state=${state}`).set('Cookie', cookie);

  expect(res.status).toBe(302);
  expect(res.headers.location).toMatch(/^http:\/\/localhost:5173\/login#token=/);
  const token = res.headers.location.split('#token=')[1];
  const me = await request(app).get('/auth/me').set(bearer(token));
  expect(me.body).toMatchObject({ email: 'link@psu.edu', name: 'Prof Link', role: 'professor', linkedin: true });
});

test('callback links an existing local account by email instead of creating a second one', async () => {
  const local = await registerUser('student', 'local@psu.edu', 'Local Student');
  linkedin.getUserInfo.mockResolvedValue({ id: 'li-456', name: 'Local Student', email: 'local@psu.edu' });
  const start = await request(app).get('/auth/linkedin?role=professor');
  const { cookie, state } = stateFrom(start);

  const res = await request(app).get(`/auth/linkedin/callback?code=c&state=${state}`).set('Cookie', cookie);
  const token = res.headers.location.split('#token=')[1];
  const me = await request(app).get('/auth/me').set(bearer(token));

  expect(me.body.id).toBe(local.id);
  expect(me.body.role).toBe('student');
  expect(me.body.linkedin).toBe(true);
});

test('callback turns a LinkedIn failure into a 502', async () => {
  linkedin.exchangeCode.mockRejectedValue(Object.assign(new Error('LinkedIn token exchange failed with status 400'), { status: 502 }));
  const start = await request(app).get('/auth/linkedin');
  const { cookie, state } = stateFrom(start);

  const res = await request(app).get(`/auth/linkedin/callback?code=c&state=${state}`).set('Cookie', cookie);

  expect(res.status).toBe(502);
});

test('a LinkedIn professor can share their own opening', async () => {
  const start = await request(app).get('/auth/linkedin?role=professor');
  const { cookie, state } = stateFrom(start);
  const login = await request(app).get(`/auth/linkedin/callback?code=c&state=${state}`).set('Cookie', cookie);
  const token = login.headers.location.split('#token=')[1];
  const job = await request(app).post('/api/jobs').set(bearer(token)).send(jobBody);

  const res = await request(app).post(`/api/jobs/${job.body.id}/share`).set(bearer(token));

  expect(res.status).toBe(200);
  expect(res.body.postId).toBe('urn:li:share:1');
  expect(res.body.url).toBe(`http://localhost:5173/jobs/${job.body.id}`);
  const [accessToken, linkedinId, text] = linkedin.shareOpening.mock.calls[0];
  expect(accessToken).toBe('li-token');
  expect(linkedinId).toBe('li-123');
  expect(text).toContain(jobBody.title);
});

test('share reports 502 when LinkedIn refuses the post', async () => {
  linkedin.shareOpening.mockRejectedValue(Object.assign(new Error('LinkedIn share failed with status 403'), { status: 502 }));
  const start = await request(app).get('/auth/linkedin?role=professor');
  const { cookie, state } = stateFrom(start);
  const login = await request(app).get(`/auth/linkedin/callback?code=c&state=${state}`).set('Cookie', cookie);
  const token = login.headers.location.split('#token=')[1];
  const job = await request(app).post('/api/jobs').set(bearer(token)).send(jobBody);

  const res = await request(app).post(`/api/jobs/${job.body.id}/share`).set(bearer(token));

  expect(res.status).toBe(502);
});
