// Job routes. Anyone logged in can browse open positions. A professor creates, edits, closes,
// and shares their own openings and lists the applicants for them.
const express = require('express');
const db = require('../db');
const linkedin = require('../services/linkedin');
const { requireAuth, requireRole } = require('../auth');
const { validateJob, buildJobFilter } = require('../rules');
const { jobsCreated, linkedinShares } = require('../metrics');

const router = express.Router();
router.use(requireAuth);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Loads the job for :id routes. Only the owning professor may change it.
async function loadJob(req, res, next) {
  try {
    const job = await db.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not Found', message: 'Opening does not exist' });
    req.job = job;
    next();
  } catch (error) {
    next(error);
  }
}

function requireOwner(req, res, next) {
  if (req.user.role !== 'professor' || req.job.professorId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden', message: 'Not your opening' });
  }
  next();
}

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: List openings
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: q, schema: { type: string }, description: Text search }
 *       - { in: query, name: department, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string, enum: [RA, TA] } }
 *       - { in: query, name: maxGpa, schema: { type: number }, description: Only openings whose minimum GPA is at or below this }
 *       - { in: query, name: status, schema: { type: string, enum: [open, closed] } }
 *       - { in: query, name: mine, schema: { type: boolean }, description: Professors only, list my openings }
 *     responses:
 *       200: { description: Openings, newest first }
 *   post:
 *     tags: [Jobs]
 *     summary: Post an opening (professor)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, department, type]
 *             properties:
 *               title: { type: string }
 *               department: { type: string }
 *               type: { type: string, enum: [RA, TA] }
 *               hoursPerWeek: { type: integer }
 *               pay: { type: string }
 *               minGpa: { type: number }
 *               skills: { type: array, items: { type: string } }
 *               description: { type: string }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Invalid input }
 *       403: { description: Students cannot post }
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = buildJobFilter(req.query);
    if (req.query.mine === 'true' && req.user.role === 'professor') {
      filter.professorId = req.user.id;
      if (!req.query.status) delete filter.status;
    }
    res.json(await db.listJobs(filter));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('professor'), async (req, res, next) => {
  try {
    const { errors, value } = validateJob(req.body);
    if (errors.length) return res.status(400).json({ error: 'Bad Request', message: errors[0], errors });
    const job = await db.createJob({ ...value, professorId: req.user.id });
    jobsCreated.inc();
    req.log.info({ event: 'job.created', jobId: job.id, professorId: req.user.id }, 'job created');
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     tags: [Jobs]
 *     summary: Read one opening
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: The opening }
 *       404: { description: No such opening }
 *   put:
 *     tags: [Jobs]
 *     summary: Edit an opening (owner)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Updated }
 *       403: { description: Not your opening }
 */
router.get('/:id', loadJob, (req, res) => {
  res.json(req.job);
});

router.put('/:id', loadJob, requireOwner, async (req, res, next) => {
  try {
    const { errors, value } = validateJob(req.body);
    if (errors.length) return res.status(400).json({ error: 'Bad Request', message: errors[0], errors });
    Object.assign(req.job, value);
    res.json(await db.saveJob(req.job));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/jobs/{id}/close:
 *   post:
 *     tags: [Jobs]
 *     summary: Close an opening (owner)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Closed }
 *       403: { description: Not your opening }
 */
router.post('/:id/close', loadJob, requireOwner, async (req, res, next) => {
  try {
    req.job.status = 'closed';
    req.log.info({ event: 'job.closed', jobId: req.job.id }, 'job closed');
    res.json(await db.saveJob(req.job));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/jobs/{id}/applications:
 *   get:
 *     tags: [Jobs]
 *     summary: List applicants for an opening (owner)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Applications, newest first }
 *       403: { description: Not your opening }
 */
router.get('/:id/applications', loadJob, requireOwner, async (req, res, next) => {
  try {
    res.json(await db.listApplications({ jobId: req.job.id }));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/jobs/{id}/share:
 *   post:
 *     tags: [Jobs]
 *     summary: Share an opening on LinkedIn (owner, LinkedIn login required)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Posted, returns the LinkedIn post id and a link to the post }
 *       403: { description: Not your opening }
 *       409: { description: Sign in with LinkedIn first }
 *       502: { description: LinkedIn rejected the post }
 */
router.post('/:id/share', loadJob, requireOwner, async (req, res, next) => {
  try {
    const user = await db.findUserById(req.user.id);
    const expired = !user?.linkedinTokenExpiresAt || user.linkedinTokenExpiresAt < new Date();
    if (!user?.linkedinId || !user.linkedinToken || expired) {
      return res.status(409).json({ error: 'Conflict', message: 'Sign in with LinkedIn as a professor to share openings' });
    }
    const text = `${req.job.type} opening: ${req.job.title} in ${req.job.department}. Minimum GPA ${req.job.minGpa.toFixed(2)}. Apply on Campus Works.`;
    const url = `${FRONTEND_URL}/jobs/${req.job.id}`;
    try {
      const postId = await linkedin.shareOpening(user.linkedinToken, user.linkedinId, text, url);
      linkedinShares.inc({ result: 'success' });
      req.log.info({ event: 'job.shared', jobId: req.job.id, postId }, 'job shared on linkedin');
      res.json({ postId, postUrl: `https://www.linkedin.com/feed/update/${postId}/`, text, url });
    } catch (error) {
      linkedinShares.inc({ result: 'failure' });
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
