// Seeds demo accounts, profiles, and openings. Safe to run more than once.
// Usage: npm run seed   (uses MONGODB_URI from .env)
require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const db = require('../backend/db');

const password = 'Password123';

const users = [
  { email: 'prof@psu.edu', name: 'Dr. Maria Chen', role: 'professor', profile: { department: 'Computer Science', contact: 'prof@psu.edu, Westgate W312' } },
  { email: 'prof2@psu.edu', name: 'Dr. Alan Reyes', role: 'professor', profile: { department: 'Mathematics', contact: 'prof2@psu.edu' } },
  { email: 'student@psu.edu', name: 'Jordan Park', role: 'student', profile: { major: 'Computer Science', gpa: 3.7, skills: ['python', 'pytorch', 'sql'], resumeUrl: 'https://example.com/jordan-park-resume.pdf' } },
  { email: 'student2@psu.edu', name: 'Sam Okafor', role: 'student', profile: { major: 'Mechanical Engineering', gpa: 2.8, skills: ['matlab', 'solidworks'], resumeUrl: 'https://example.com/sam-okafor-resume.pdf' } }
];

const jobs = [
  { owner: 'prof@psu.edu', title: 'Research assistant, computer vision lab', department: 'Computer Science', type: 'RA', hoursPerWeek: 10, pay: '$16/hr', minGpa: 3.5, skills: ['python', 'pytorch'], description: 'Help label datasets and run training jobs for a medical imaging project. Weekly lab meeting on Thursdays.' },
  { owner: 'prof@psu.edu', title: 'TA for CMPSC 221 Object Oriented Programming', department: 'Computer Science', type: 'TA', hoursPerWeek: 12, pay: '$15/hr', minGpa: 3.0, skills: ['java'], description: 'Grade assignments, hold two office hours a week, and answer questions on the course forum.' },
  { owner: 'prof@psu.edu', title: 'Research assistant, database systems', department: 'Computer Science', type: 'RA', hoursPerWeek: 8, pay: '$16/hr', minGpa: 3.8, skills: ['sql', 'c++'], description: 'Benchmark query engines and write up results.' },
  { owner: 'prof2@psu.edu', title: 'TA for MATH 140 Calculus', department: 'Mathematics', type: 'TA', hoursPerWeek: 10, pay: '$14/hr', minGpa: 2.5, skills: [], description: 'Lead one recitation section and grade weekly quizzes.' }
];

async function main() {
  await db.initializeDatabase();
  const passwordHash = await bcrypt.hash(password, 10);
  const byEmail = {};
  for (const item of users) {
    let user = await db.findUserByEmail(item.email);
    if (!user) user = await db.createUser({ email: item.email, name: item.name, role: item.role, passwordHash });
    await db.upsertProfile(user.id, item.profile);
    byEmail[item.email] = user;
  }
  for (const item of jobs) {
    const owner = byEmail[item.owner];
    const existing = await db.listJobs({ professorId: owner.id, title: item.title });
    if (existing.length === 0) {
      const { owner: _owner, ...data } = item;
      await db.createJob({ ...data, professorId: owner.id });
    }
  }
  console.log(`Seeded ${users.length} accounts and ${jobs.length} openings. Password for every account: ${password}`);
  await db.closeDatabase();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
