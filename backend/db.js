// MongoDB access with mongoose. Defines the user, profile, job, and application models
// and the read/write functions the routes use.
const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusworks';

const ROLES = ['student', 'professor'];
const JOB_TYPES = ['RA', 'TA'];
const JOB_STATUSES = ['open', 'closed'];
const APPLICATION_STATUSES = ['submitted', 'reviewed', 'accepted', 'rejected'];

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, enum: ROLES, required: true },
  passwordHash: { type: String, default: null },
  linkedinId: { type: String, default: null, index: true },
  linkedinToken: { type: String, default: null },
  linkedinTokenExpiresAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

const profileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  major: { type: String, default: null, trim: true },
  gpa: { type: Number, min: 0, max: 4, default: null },
  skills: { type: [String], default: [] },
  resumeUrl: { type: String, default: null, trim: true },
  department: { type: String, default: null, trim: true },
  contact: { type: String, default: null, trim: true }
}, { timestamps: true, versionKey: false });

const jobSchema = new mongoose.Schema({
  professorId: { type: String, required: true, index: true },
  professorName: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true },
  type: { type: String, enum: JOB_TYPES, required: true },
  hoursPerWeek: { type: Number, min: 1, max: 40, default: null },
  pay: { type: String, default: null, trim: true },
  minGpa: { type: Number, min: 0, max: 4, default: 0 },
  skills: { type: [String], default: [] },
  description: { type: String, default: '', trim: true },
  status: { type: String, enum: JOB_STATUSES, default: 'open', index: true }
}, { timestamps: true, versionKey: false });

jobSchema.index({ title: 'text', description: 'text', department: 'text' });

const applicationSchema = new mongoose.Schema({
  jobId: { type: String, required: true, index: true },
  studentId: { type: String, required: true, index: true },
  resumeUrl: { type: String, required: true },
  gpaAtApply: { type: Number, required: true },
  status: { type: String, enum: APPLICATION_STATUSES, default: 'submitted' },
  note: { type: String, default: '', trim: true }
}, { timestamps: true, versionKey: false });

applicationSchema.index({ jobId: 1, studentId: 1 }, { unique: true });

// API responses show a plain id and never the password hash or LinkedIn token.
for (const schema of [userSchema, profileSchema, jobSchema, applicationSchema]) {
  schema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
      delete ret._id;
      delete ret.passwordHash;
      delete ret.linkedinToken;
      delete ret.linkedinTokenExpiresAt;
    }
  });
}

const User = mongoose.model('User', userSchema);
const Profile = mongoose.model('Profile', profileSchema);
const Job = mongoose.model('Job', jobSchema);
const Application = mongoose.model('Application', applicationSchema);

async function initializeDatabase(uri = mongoUri) {
  await mongoose.connect(uri);
}

async function closeDatabase() {
  await mongoose.disconnect();
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

async function createUser(data) {
  return User.create(data);
}

async function findUserByEmail(email) {
  return (await User.findOne({ email: email.toLowerCase() })) || null;
}

async function findUserById(id) {
  if (!validId(id)) return null;
  return (await User.findById(id)) || null;
}

async function findUserByLinkedinId(linkedinId) {
  return (await User.findOne({ linkedinId })) || null;
}

async function saveUser(user) {
  return user.save();
}

async function getProfile(userId) {
  return (await Profile.findOne({ userId })) || null;
}

async function upsertProfile(userId, data) {
  return Profile.findOneAndUpdate({ userId }, { $set: data }, { upsert: true, returnDocument: 'after' });
}

async function createJob(data) {
  return Job.create(data);
}

async function getJob(id) {
  if (!validId(id)) return null;
  return (await Job.findById(id)) || null;
}

async function saveJob(job) {
  return job.save();
}

async function listJobs(filter) {
  return Job.find(filter).sort({ createdAt: -1 });
}

async function createApplication(data) {
  return Application.create(data);
}

async function getApplication(id) {
  if (!validId(id)) return null;
  return (await Application.findById(id)) || null;
}

async function saveApplication(application) {
  return application.save();
}

async function listApplications(filter) {
  return Application.find(filter).sort({ createdAt: -1 });
}

async function findApplication(jobId, studentId) {
  return (await Application.findOne({ jobId, studentId })) || null;
}

module.exports = {
  ROLES,
  JOB_TYPES,
  JOB_STATUSES,
  APPLICATION_STATUSES,
  initializeDatabase,
  closeDatabase,
  isConnected,
  createUser,
  findUserByEmail,
  findUserById,
  findUserByLinkedinId,
  saveUser,
  getProfile,
  upsertProfile,
  createJob,
  getJob,
  saveJob,
  listJobs,
  createApplication,
  getApplication,
  saveApplication,
  listApplications,
  findApplication
};
