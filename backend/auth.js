// Auth. Local register and login with JWT, LinkedIn sign in, and the requireAuth and requireRole middleware.
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const db = require('./db');
const linkedin = require('./services/linkedin');
const { validateRegistration } = require('./rules');
const { loginAttempts } = require('./metrics');

const JWT_SECRET = process.env.JWT_SECRET || 'development-only-jwt-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const STATE_COOKIE = 'linkedin_state';

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, linkedin: Boolean(user.linkedinId) };
}

// Reads the bearer token and puts the user claims on req.user.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized', message: 'Valid login is required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid login is required' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden', message: `Requires ${role} role` });
    }
    next();
  };
}

const router = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create an account and get a token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, role]
 *             properties:
 *               email: { type: string }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *               role: { type: string, enum: [student, professor] }
 *     responses:
 *       201: { description: Account created }
 *       400: { description: Invalid input }
 *       409: { description: Email already registered }
 */
router.post('/register', async (req, res, next) => {
  try {
    const { errors, value } = validateRegistration(req.body);
    if (errors.length) return res.status(400).json({ error: 'Bad Request', message: errors[0], errors });
    if (await db.findUserByEmail(value.email)) {
      return res.status(409).json({ error: 'Conflict', message: 'Email is already registered' });
    }
    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await db.createUser({ email: value.email, name: value.name, role: value.role, passwordHash });
    req.log.info({ event: 'user.registered', userId: user.id, role: user.role }, 'user registered');
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Logged in }
 *       401: { description: Wrong email or password }
 */
router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = email ? await db.findUserByEmail(email) : null;
    const valid = user && user.passwordHash && await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      loginAttempts.inc({ provider: 'local', result: 'failure' });
      req.log.warn({ event: 'login.failed', provider: 'local' }, 'login failed');
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
    }
    loginAttempts.inc({ provider: 'local', result: 'success' });
    req.log.info({ event: 'login.success', provider: 'local', userId: user.id, role: user.role }, 'login ok');
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current user from the token
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The user }
 *       401: { description: Not logged in }
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) return res.status(401).json({ error: 'Unauthorized', message: 'Valid login is required' });
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/linkedin:
 *   get:
 *     tags: [Auth]
 *     summary: Start LinkedIn sign in (browser only)
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [student, professor] }
 *     responses:
 *       302: { description: Redirect to LinkedIn }
 *       503: { description: LinkedIn is not configured }
 */
router.get('/linkedin', (req, res) => {
  if (!linkedin.isConfigured()) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'LinkedIn sign in is not configured' });
  }
  const role = db.ROLES.includes(req.query.role) ? req.query.role : 'student';
  const state = randomUUID();
  res.cookie(STATE_COOKIE, `${state}:${role}`, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 });
  res.redirect(linkedin.authorizationUrl(state, role));
});

// LinkedIn redirects here. Links or creates the account, then sends the browser back to the app with a token.
router.get('/linkedin/callback', async (req, res, next) => {
  try {
    if (!linkedin.isConfigured()) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'LinkedIn sign in is not configured' });
    }
    const [savedState, role] = String(req.cookies?.[STATE_COOKIE] || '').split(':');
    res.clearCookie(STATE_COOKIE);
    if (!req.query.code || !req.query.state || req.query.state !== savedState) {
      loginAttempts.inc({ provider: 'linkedin', result: 'failure' });
      return res.status(400).json({ error: 'Bad Request', message: 'LinkedIn sign in was cancelled or the state did not match' });
    }
    const token = await linkedin.exchangeCode(req.query.code);
    const info = await linkedin.getUserInfo(token.accessToken);
    let user = await db.findUserByLinkedinId(info.id);
    if (!user && info.email) user = await db.findUserByEmail(info.email);
    if (!user) {
      user = await db.createUser({ email: info.email, name: info.name, role: role || 'student', linkedinId: info.id });
      req.log.info({ event: 'user.registered', provider: 'linkedin', userId: user.id, role: user.role }, 'user registered');
    }
    user.linkedinId = info.id;
    user.linkedinToken = token.accessToken;
    user.linkedinTokenExpiresAt = new Date(Date.now() + token.expiresIn * 1000);
    await db.saveUser(user);
    loginAttempts.inc({ provider: 'linkedin', result: 'success' });
    req.log.info({ event: 'login.success', provider: 'linkedin', userId: user.id, role: user.role }, 'login ok');
    res.redirect(`${FRONTEND_URL}/login#token=${signToken(user)}`);
  } catch (error) {
    loginAttempts.inc({ provider: 'linkedin', result: 'failure' });
    next(error);
  }
});

module.exports = { router, requireAuth, requireRole, signToken };
