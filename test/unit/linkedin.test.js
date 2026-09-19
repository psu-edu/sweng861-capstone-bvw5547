// Unit tests for the LinkedIn client with fetch mocked. No network is used.
const linkedin = require('../../backend/services/linkedin');

function mockFetch(status, body, headers = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
    headers: { get: (name) => headers[name.toLowerCase()] || null }
  });
}

beforeEach(() => {
  process.env.LINKEDIN_CLIENT_ID = 'client-id';
  process.env.LINKEDIN_CLIENT_SECRET = 'client-secret';
  process.env.LINKEDIN_REDIRECT_URI = 'http://localhost:3000/auth/linkedin/callback';
});

test('isConfigured needs both the id and the secret', () => {
  expect(linkedin.isConfigured()).toBe(true);

  process.env.LINKEDIN_CLIENT_SECRET = '';

  expect(linkedin.isConfigured()).toBe(false);
});

test('authorizationUrl carries state, redirect, and the scopes for the role', () => {
  const student = new URL(linkedin.authorizationUrl('abc', 'student'));
  const professor = new URL(linkedin.authorizationUrl('abc', 'professor'));

  expect(student.origin + student.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization');
  expect(student.searchParams.get('client_id')).toBe('client-id');
  expect(student.searchParams.get('state')).toBe('abc');
  expect(student.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/linkedin/callback');
  expect(student.searchParams.get('scope')).toBe('openid profile email');
  expect(professor.searchParams.get('scope')).toBe('openid profile email w_member_social');
});

test('exchangeCode posts the form and returns the token', async () => {
  mockFetch(200, { access_token: 'tok', expires_in: '5184000', scope: 'openid' });

  const token = await linkedin.exchangeCode('the-code');

  expect(token).toEqual({ accessToken: 'tok', expiresIn: 5184000, scope: 'openid' });
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('https://www.linkedin.com/oauth/v2/accessToken');
  expect(options.method).toBe('POST');
  expect(String(options.body)).toContain('code=the-code');
  expect(String(options.body)).toContain('client_secret=client-secret');
});

test('exchangeCode fails with 502 when LinkedIn rejects the code', async () => {
  mockFetch(400, { error: 'invalid_grant' });

  await expect(linkedin.exchangeCode('bad')).rejects.toMatchObject({ status: 502 });
});

test('getUserInfo maps sub, name, and email', async () => {
  mockFetch(200, { sub: 'abc123', name: 'Bin Wu', email: 'bin@example.com', picture: 'x' });

  const info = await linkedin.getUserInfo('tok');

  expect(info).toEqual({ id: 'abc123', name: 'Bin Wu', email: 'bin@example.com' });
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
});

test('shareOpening posts an article share as the member and returns the post id', async () => {
  mockFetch(201, {}, { 'x-restli-id': 'urn:li:share:99' });

  const id = await linkedin.shareOpening('tok', 'abc123', 'RA opening', 'http://localhost:5173/jobs/1');

  expect(id).toBe('urn:li:share:99');
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('https://api.linkedin.com/v2/ugcPosts');
  expect(options.headers['X-Restli-Protocol-Version']).toBe('2.0.0');
  const body = JSON.parse(options.body);
  expect(body.author).toBe('urn:li:person:abc123');
  expect(body.specificContent['com.linkedin.ugc.ShareContent'].media[0].originalUrl).toBe('http://localhost:5173/jobs/1');
});

test('shareOpening fails with 502 when the post is refused', async () => {
  mockFetch(403, { message: 'no scope' });

  await expect(linkedin.shareOpening('tok', 'abc123', 'x', 'y')).rejects.toMatchObject({ status: 502 });
});
