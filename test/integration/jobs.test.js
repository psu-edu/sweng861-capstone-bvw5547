// Integration tests for the job board: professor CRUD, ownership, and student search and filters.
const { app, request, startDatabase, stopDatabase, registerUser, bearer, jobBody } = require('./helpers');

let prof;
let otherProf;
let student;

beforeAll(async () => {
  await startDatabase();
  prof = await registerUser('professor', 'p1@psu.edu', 'Prof One');
  otherProf = await registerUser('professor', 'p2@psu.edu', 'Prof Two');
  student = await registerUser('student', 's1@psu.edu', 'Student One');
});

afterAll(stopDatabase);

async function createJob(token, overrides = {}) {
  const res = await request(app).post('/api/jobs').set(bearer(token)).send({ ...jobBody, ...overrides });
  expect(res.status).toBe(201);
  return res.body;
}

test('professor creates an opening and reads it back', async () => {
  const job = await createJob(prof.token);

  const res = await request(app).get(`/api/jobs/${job.id}`).set(bearer(student.token));

  expect(job.status).toBe('open');
  expect(job.professorId).toBe(prof.id);
  expect(res.status).toBe(200);
  expect(res.body.title).toBe(jobBody.title);
});

test('student cannot post an opening', async () => {
  const res = await request(app).post('/api/jobs').set(bearer(student.token)).send(jobBody);

  expect(res.status).toBe(403);
});

test('invalid opening gives 400 with the first error as message', async () => {
  const res = await request(app).post('/api/jobs').set(bearer(prof.token)).send({ ...jobBody, title: '', minGpa: 9 });

  expect(res.status).toBe(400);
  expect(res.body.message).toBe('Title is required');
  expect(res.body.errors).toHaveLength(2);
});

test('only the owner can edit or close', async () => {
  const job = await createJob(prof.token);

  const otherEdit = await request(app).put(`/api/jobs/${job.id}`).set(bearer(otherProf.token)).send({ ...jobBody, title: 'Hijacked' });
  const otherClose = await request(app).post(`/api/jobs/${job.id}/close`).set(bearer(otherProf.token));
  const ownerEdit = await request(app).put(`/api/jobs/${job.id}`).set(bearer(prof.token)).send({ ...jobBody, title: 'Renamed' });
  const ownerClose = await request(app).post(`/api/jobs/${job.id}/close`).set(bearer(prof.token));

  expect(otherEdit.status).toBe(403);
  expect(otherClose.status).toBe(403);
  expect(ownerEdit.status).toBe(200);
  expect(ownerEdit.body.title).toBe('Renamed');
  expect(ownerClose.status).toBe(200);
  expect(ownerClose.body.status).toBe('closed');
});

test('list shows open openings by default and supports filters', async () => {
  await createJob(prof.token, { title: 'TA for algorithms', type: 'TA', department: 'Mathematics', minGpa: 3.5 });
  await createJob(prof.token, { title: 'RA robotics lab', type: 'RA', department: 'Mechanical Engineering', minGpa: 2.5 });

  const all = await request(app).get('/api/jobs').set(bearer(student.token));
  const ta = await request(app).get('/api/jobs?type=TA').set(bearer(student.token));
  const dept = await request(app).get('/api/jobs?department=mechanical').set(bearer(student.token));
  const gpa = await request(app).get('/api/jobs?maxGpa=3.0').set(bearer(student.token));
  const text = await request(app).get('/api/jobs?q=robotics').set(bearer(student.token));
  const closed = await request(app).get('/api/jobs?status=closed').set(bearer(student.token));

  expect(all.body.every((job) => job.status === 'open')).toBe(true);
  expect(ta.body.map((job) => job.title)).toEqual(['TA for algorithms']);
  expect(dept.body.map((job) => job.title)).toEqual(['RA robotics lab']);
  expect(gpa.body.every((job) => job.minGpa <= 3.0)).toBe(true);
  expect(gpa.body.some((job) => job.title === 'TA for algorithms')).toBe(false);
  expect(text.body.map((job) => job.title)).toEqual(['RA robotics lab']);
  expect(closed.body.length).toBeGreaterThan(0);
  expect(closed.body.every((job) => job.status === 'closed')).toBe(true);
});

test('mine lists the professor own openings in every status', async () => {
  const mine = await request(app).get('/api/jobs?mine=true').set(bearer(prof.token));
  const others = await request(app).get('/api/jobs?mine=true').set(bearer(otherProf.token));

  expect(mine.body.length).toBeGreaterThan(2);
  expect(mine.body.every((job) => job.professorId === prof.id)).toBe(true);
  expect(mine.body.some((job) => job.status === 'closed')).toBe(true);
  expect(others.body).toEqual([]);
});

test('unknown or malformed id gives 404 and no token gives 401', async () => {
  const unknown = await request(app).get('/api/jobs/64b000000000000000000000').set(bearer(student.token));
  const malformed = await request(app).get('/api/jobs/nope').set(bearer(student.token));
  const anon = await request(app).get('/api/jobs');

  expect(unknown.status).toBe(404);
  expect(malformed.status).toBe(404);
  expect(anon.status).toBe(401);
});

test('share needs a LinkedIn login on the owner account', async () => {
  const job = await createJob(prof.token);

  const res = await request(app).post(`/api/jobs/${job.id}/share`).set(bearer(prof.token));
  const other = await request(app).post(`/api/jobs/${job.id}/share`).set(bearer(otherProf.token));

  expect(res.status).toBe(409);
  expect(other.status).toBe(403);
});
