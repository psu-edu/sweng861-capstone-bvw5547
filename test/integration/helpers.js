// Shared setup for the integration tests. Starts an in memory MongoDB and registers users over HTTP.
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../backend/app');
const db = require('../../backend/db');

let mongod;

async function startDatabase() {
  mongod = await MongoMemoryServer.create();
  await db.initializeDatabase(mongod.getUri());
}

async function stopDatabase() {
  await db.closeDatabase();
  await mongod.stop();
}

async function registerUser(role, email, name = 'Test User') {
  const res = await request(app).post('/auth/register').send({ email, name, role, password: 'Password123' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, id: res.body.user.id };
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

const studentProfile = { major: 'Computer Science', gpa: 3.6, skills: ['python', 'sql'], resumeUrl: 'https://example.com/resume.pdf' };
const jobBody = { title: 'Research assistant, vision lab', department: 'Computer Science', type: 'RA', hoursPerWeek: 10, pay: '$15/hr', minGpa: 3.0, skills: ['python'], description: 'Label and train.' };

module.exports = { app, request, db, startDatabase, stopDatabase, registerUser, bearer, studentProfile, jobBody };
