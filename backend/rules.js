// Business rules and input checks. Pure functions with no database or network,
// so the routes stay thin and the rules can be unit tested on their own.
const { ROLES, JOB_TYPES, JOB_STATUSES, APPLICATION_STATUSES } = require('./db');

const emailPattern = /^\S+@\S+\.\S+$/;
const urlPattern = /^https?:\/\/\S+$/i;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanSkills(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanText).filter(Boolean))].slice(0, 20);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function isGpa(value) {
  return typeof value === 'number' && value >= 0 && value <= 4;
}

function validateRegistration(body) {
  const errors = [];
  const email = cleanText(body?.email).toLowerCase();
  const name = cleanText(body?.name);
  const password = typeof body?.password === 'string' ? body.password : '';
  const role = cleanText(body?.role);
  if (!emailPattern.test(email)) errors.push('A valid email is required');
  if (!name) errors.push('Name is required');
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!ROLES.includes(role)) errors.push(`Role must be one of: ${ROLES.join(', ')}`);
  return { errors, value: { email, name, password, role } };
}

// Students and professors share one profile document with different required fields.
function validateProfile(role, body) {
  const errors = [];
  const value = {};
  if (role === 'student') {
    value.major = cleanText(body?.major);
    value.gpa = toNumber(body?.gpa);
    value.skills = cleanSkills(body?.skills);
    value.resumeUrl = cleanText(body?.resumeUrl);
    if (!value.major) errors.push('Major is required');
    if (!isGpa(value.gpa)) errors.push('GPA must be a number from 0 to 4');
    if (value.resumeUrl && !urlPattern.test(value.resumeUrl)) errors.push('Resume must be an http or https link');
  } else {
    value.department = cleanText(body?.department);
    value.contact = cleanText(body?.contact);
    if (!value.department) errors.push('Department is required');
  }
  return { errors, value };
}

function validateJob(body) {
  const errors = [];
  const value = {
    title: cleanText(body?.title),
    department: cleanText(body?.department),
    type: cleanText(body?.type),
    hoursPerWeek: toNumber(body?.hoursPerWeek),
    pay: cleanText(body?.pay) || null,
    minGpa: toNumber(body?.minGpa) ?? 0,
    skills: cleanSkills(body?.skills),
    description: cleanText(body?.description)
  };
  if (!value.title) errors.push('Title is required');
  if (!value.department) errors.push('Department is required');
  if (!JOB_TYPES.includes(value.type)) errors.push(`Type must be one of: ${JOB_TYPES.join(', ')}`);
  if (value.hoursPerWeek !== null && !(Number.isInteger(value.hoursPerWeek) && value.hoursPerWeek >= 1 && value.hoursPerWeek <= 40)) {
    errors.push('Hours per week must be a whole number from 1 to 40');
  }
  if (!isGpa(value.minGpa)) errors.push('Minimum GPA must be a number from 0 to 4');
  return { errors, value };
}

// A student may apply when the profile is complete, the job is open, and the GPA meets the bar.
function checkEligibility(profile, job) {
  if (!job || job.status !== 'open') return { ok: false, reason: 'This opening is closed' };
  if (!profile || !profile.major || !isGpa(profile.gpa)) {
    return { ok: false, reason: 'Complete your profile with major and GPA before applying' };
  }
  if (!profile.resumeUrl) return { ok: false, reason: 'Add a resume link to your profile before applying' };
  if (profile.gpa < job.minGpa) {
    return { ok: false, reason: `This opening requires a GPA of ${job.minGpa.toFixed(2)} or higher` };
  }
  return { ok: true, reason: null };
}

// Professors move an application forward. A decided application does not change again.
const transitions = {
  submitted: ['reviewed', 'accepted', 'rejected'],
  reviewed: ['accepted', 'rejected'],
  accepted: [],
  rejected: []
};

function canTransition(from, to) {
  return APPLICATION_STATUSES.includes(to) && (transitions[from] || []).includes(to);
}

// Turns query string values into a mongoose filter for the job list.
function buildJobFilter(query) {
  const filter = {};
  const status = cleanText(query?.status);
  filter.status = JOB_STATUSES.includes(status) ? status : 'open';
  const department = cleanText(query?.department);
  if (department) filter.department = new RegExp(escapeRegex(department), 'i');
  const type = cleanText(query?.type);
  if (JOB_TYPES.includes(type)) filter.type = type;
  const maxGpa = toNumber(query?.maxGpa);
  if (isGpa(maxGpa)) filter.minGpa = { $lte: maxGpa };
  const q = cleanText(query?.q);
  if (q) filter.$text = { $search: q };
  return filter;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  cleanText,
  cleanSkills,
  validateRegistration,
  validateProfile,
  validateJob,
  checkEligibility,
  canTransition,
  buildJobFilter
};
