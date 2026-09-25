// Integration tests for register, login, the current user endpoint, and the LinkedIn routes when not configured.
const { app, request, startDatabase, stopDatabase, bearer } = require('./helpers');

const account = { email: 'prof@psu.edu', name: 'Prof Lee', role: 'professor', password: 'Password123' };

beforeAll(startDatabase);
afterAll(stopDatabase);

test('register returns 201 with a token and no secrets', async () => {
  const res = await request(app).post('/auth/register').send(account);

  expect(res.status).toBe(201);
  expect(typeof res.body.token).toBe('string');
  expect(res.body.user).toEqual({ id: expect.any(String), email: 'prof@psu.edu', name: 'Prof Lee', role: 'professor', linkedin: false });
  expect(res.body.user.passwordHash).toBeUndefined();
});

test('register rejects bad input with 400 and a list of errors', async () => {
  const res = await request(app).post('/auth/register').send({ email: 'x', password: '1', name: '', role: 'dean' });

  expect(res.status).toBe(400);
  expect(res.body.errors).toHaveLength(4);
});

test('register rejects a duplicate email with 409', async () => {
  const res = await request(app).post('/auth/register').send(account);

  expect(res.status).toBe(409);
});

test('login returns 200 with the right password and 401 otherwise', async () => {
  const ok = await request(app).post('/auth/login').send({ email: 'PROF@psu.edu', password: 'Password123' });
  const bad = await request(app).post('/auth/login').send({ email: 'prof@psu.edu', password: 'nope' });
  const missing = await request(app).post('/auth/login').send({});

  expect(ok.status).toBe(200);
  expect(ok.body.user.role).toBe('professor');
  expect(bad.status).toBe(401);
  expect(missing.status).toBe(401);
});

test('me returns the user with a valid token and 401 without one', async () => {
  const login = await request(app).post('/auth/login').send({ email: 'prof@psu.edu', password: 'Password123' });

  const me = await request(app).get('/auth/me').set(bearer(login.body.token));
  const none = await request(app).get('/auth/me');
  const junk = await request(app).get('/auth/me').set(bearer('not.a.token'));

  expect(me.status).toBe(200);
  expect(me.body.email).toBe('prof@psu.edu');
  expect(none.status).toBe(401);
  expect(junk.status).toBe(401);
});

test('linkedin routes return 503 when not configured', async () => {
  const start = await request(app).get('/auth/linkedin?role=professor');
  const callback = await request(app).get('/auth/linkedin/callback?code=x&state=y');

  expect(start.status).toBe(503);
  expect(callback.status).toBe(503);
});

test('health reports the database and metrics are exposed', async () => {
  const health = await request(app).get('/health');
  const metrics = await request(app).get('/metrics');

  expect(health.body).toEqual({ status: 'UP', db: 'UP' });
  expect(metrics.text).toContain('login_attempts_total');
});
