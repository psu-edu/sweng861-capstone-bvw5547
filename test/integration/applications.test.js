// Integration tests for profiles and the application flow: GPA gate, duplicates, ownership, and status changes.
const { app, request, startDatabase, stopDatabase, registerUser, bearer, studentProfile, jobBody } = require('./helpers');

let prof;
let otherProf;
let student;
let weakStudent;
let job;

beforeAll(async () => {
  await startDatabase();
  prof = await registerUser('professor', 'p1@psu.edu', 'Prof One');
  otherProf = await registerUser('professor', 'p2@psu.edu', 'Prof Two');
  student = await registerUser('student', 's1@psu.edu', 'Student One');
  weakStudent = await registerUser('student', 's2@psu.edu', 'Student Two');
  await request(app).put('/api/profiles/me').set(bearer(prof.token)).send({ department: 'Computer Science', contact: 'p1@psu.edu' });
  await request(app).put('/api/profiles/me').set(bearer(student.token)).send(studentProfile);
  await request(app).put('/api/profiles/me').set(bearer(weakStudent.token)).send({ ...studentProfile, gpa: 2.4 });
  const created = await request(app).post('/api/jobs').set(bearer(prof.token)).send(jobBody);
  job = created.body;
});

afterAll(stopDatabase);

test('profile is saved and read back, and invalid input gives 400', async () => {
  const me = await request(app).get('/api/profiles/me').set(bearer(student.token));
  const bad = await request(app).put('/api/profiles/me').set(bearer(student.token)).send({ major: 'CS', gpa: 7 });

  expect(me.status).toBe(200);
  expect(me.body.gpa).toBe(3.6);
  expect(me.body.skills).toEqual(['python', 'sql']);
  expect(bad.status).toBe(400);
  expect(bad.body.message).toBe('GPA must be a number from 0 to 4');
});

test('empty profile comes back as an empty shell, not 404', async () => {
  const fresh = await registerUser('student', 's3@psu.edu', 'Student Three');

  const res = await request(app).get('/api/profiles/me').set(bearer(fresh.token));

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ userId: fresh.id, skills: [] });
});

test('student below the minimum GPA is rejected with 422 and the reason', async () => {
  const res = await request(app).post('/api/applications').set(bearer(weakStudent.token)).send({ jobId: job.id });

  expect(res.status).toBe(422);
  expect(res.body.message).toBe('This opening requires a GPA of 3.00 or higher');
});

test('student without a profile is told to complete it', async () => {
  const fresh = await registerUser('student', 's4@psu.edu', 'Student Four');

  const res = await request(app).post('/api/applications').set(bearer(fresh.token)).send({ jobId: job.id });

  expect(res.status).toBe(422);
  expect(res.body.message).toMatch(/Complete your profile/);
});

test('eligible student applies once, sees it, and cannot apply twice', async () => {
  const first = await request(app).post('/api/applications').set(bearer(student.token)).send({ jobId: job.id, note: 'Keen.' });
  const again = await request(app).post('/api/applications').set(bearer(student.token)).send({ jobId: job.id });
  const mine = await request(app).get('/api/applications').set(bearer(student.token));

  expect(first.status).toBe(201);
  expect(first.body.status).toBe('submitted');
  expect(first.body.gpaAtApply).toBe(3.6);
  expect(first.body.resumeUrl).toBe(studentProfile.resumeUrl);
  expect(again.status).toBe(409);
  expect(mine.body.map((a) => a.id)).toEqual([first.body.id]);
});

test('professor cannot apply and student cannot list by job', async () => {
  const apply = await request(app).post('/api/applications').set(bearer(prof.token)).send({ jobId: job.id });
  const list = await request(app).get(`/api/applications?jobId=${job.id}`).set(bearer(student.token));

  expect(apply.status).toBe(403);
  expect(list.status).toBe(200);
  expect(list.body.every((a) => a.studentId === student.id)).toBe(true);
});

test('only the owning professor lists applicants and reads the applicant profile', async () => {
  const owner = await request(app).get(`/api/applications?jobId=${job.id}`).set(bearer(prof.token));
  const viaJob = await request(app).get(`/api/jobs/${job.id}/applications`).set(bearer(prof.token));
  const other = await request(app).get(`/api/applications?jobId=${job.id}`).set(bearer(otherProf.token));
  const profile = await request(app).get(`/api/profiles/${student.id}`).set(bearer(prof.token));
  const otherProfile = await request(app).get(`/api/profiles/${student.id}`).set(bearer(otherProf.token));
  const studentView = await request(app).get(`/api/profiles/${weakStudent.id}`).set(bearer(student.token));

  expect(owner.status).toBe(200);
  expect(owner.body).toHaveLength(1);
  expect(viaJob.body).toHaveLength(1);
  expect(other.status).toBe(403);
  expect(profile.status).toBe(200);
  expect(profile.body.major).toBe('Computer Science');
  expect(otherProfile.status).toBe(403);
  expect(studentView.status).toBe(403);
});

test('status moves forward for the owner only and never backwards', async () => {
  const list = await request(app).get(`/api/applications?jobId=${job.id}`).set(bearer(prof.token));
  const id = list.body[0].id;

  const other = await request(app).patch(`/api/applications/${id}/status`).set(bearer(otherProf.token)).send({ status: 'reviewed' });
  const reviewed = await request(app).patch(`/api/applications/${id}/status`).set(bearer(prof.token)).send({ status: 'reviewed' });
  const back = await request(app).patch(`/api/applications/${id}/status`).set(bearer(prof.token)).send({ status: 'submitted' });
  const accepted = await request(app).patch(`/api/applications/${id}/status`).set(bearer(prof.token)).send({ status: 'accepted' });
  const after = await request(app).patch(`/api/applications/${id}/status`).set(bearer(prof.token)).send({ status: 'rejected' });
  const missing = await request(app).patch('/api/applications/64b000000000000000000000/status').set(bearer(prof.token)).send({ status: 'reviewed' });

  expect(other.status).toBe(403);
  expect(reviewed.status).toBe(200);
  expect(reviewed.body.status).toBe('reviewed');
  expect(back.status).toBe(400);
  expect(accepted.status).toBe(200);
  expect(after.status).toBe(400);
  expect(missing.status).toBe(404);
});

test('applying to a closed opening is refused', async () => {
  await request(app).post(`/api/jobs/${job.id}/close`).set(bearer(prof.token));
  const fresh = await registerUser('student', 's5@psu.edu', 'Student Five');
  await request(app).put('/api/profiles/me').set(bearer(fresh.token)).send(studentProfile);

  const res = await request(app).post('/api/applications').set(bearer(fresh.token)).send({ jobId: job.id });

  expect(res.status).toBe(422);
  expect(res.body.message).toBe('This opening is closed');
});
