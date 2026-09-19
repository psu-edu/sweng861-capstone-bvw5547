// Application routes. A student applies to an open position once, after the GPA check.
// A professor reviews applications to their own openings and moves them through the statuses.
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { checkEligibility, canTransition } = require('../rules');
const { applicationsTotal } = require('../metrics');

const router = express.Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/applications:
 *   post:
 *     tags: [Applications]
 *     summary: Apply to an opening (student)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [jobId]
 *             properties:
 *               jobId: { type: string }
 *               note: { type: string }
 *     responses:
 *       201: { description: Application created }
 *       403: { description: Professors cannot apply }
 *       404: { description: No such opening }
 *       409: { description: Already applied }
 *       422: { description: Not eligible, the message says why }
 *   get:
 *     tags: [Applications]
 *     summary: List applications. Students see their own. Professors pass jobId for one of their openings.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: query, name: jobId, schema: { type: string } }]
 *     responses:
 *       200: { description: Applications, newest first }
 */
router.post('/', requireRole('student'), async (req, res, next) => {
  try {
    const job = await db.getJob(req.body?.jobId);
    if (!job) return res.status(404).json({ error: 'Not Found', message: 'Opening does not exist' });
    if (await db.findApplication(job.id, req.user.id)) {
      applicationsTotal.inc({ outcome: 'duplicate' });
      return res.status(409).json({ error: 'Conflict', message: 'You already applied to this opening' });
    }
    const profile = await db.getProfile(req.user.id);
    const eligibility = checkEligibility(profile, job);
    if (!eligibility.ok) {
      applicationsTotal.inc({ outcome: 'ineligible' });
      req.log.info({ event: 'application.rejected', jobId: job.id, studentId: req.user.id, reason: eligibility.reason }, 'application rejected');
      return res.status(422).json({ error: 'Unprocessable Entity', message: eligibility.reason });
    }
    const application = await db.createApplication({
      jobId: job.id,
      studentId: req.user.id,
      resumeUrl: profile.resumeUrl,
      gpaAtApply: profile.gpa,
      note: typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 1000) : ''
    });
    applicationsTotal.inc({ outcome: 'submitted' });
    req.log.info({ event: 'application.submitted', applicationId: application.id, jobId: job.id, studentId: req.user.id }, 'application submitted');
    res.status(201).json(application);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.json(await db.listApplications({ studentId: req.user.id }));
    }
    const job = await db.getJob(req.query.jobId);
    if (!job) return res.status(404).json({ error: 'Not Found', message: 'Opening does not exist' });
    if (job.professorId !== req.user.id) return res.status(403).json({ error: 'Forbidden', message: 'Not your opening' });
    res.json(await db.listApplications({ jobId: job.id }));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/applications/{id}/status:
 *   patch:
 *     tags: [Applications]
 *     summary: Move an application to reviewed, accepted, or rejected (owning professor)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [reviewed, accepted, rejected] }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Transition not allowed }
 *       403: { description: Not your opening }
 *       404: { description: No such application }
 */
router.patch('/:id/status', requireRole('professor'), async (req, res, next) => {
  try {
    const application = await db.getApplication(req.params.id);
    if (!application) return res.status(404).json({ error: 'Not Found', message: 'Application does not exist' });
    const job = await db.getJob(application.jobId);
    if (!job || job.professorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Not your opening' });
    }
    const status = req.body?.status;
    if (!canTransition(application.status, status)) {
      return res.status(400).json({ error: 'Bad Request', message: `Cannot move from ${application.status} to ${status}` });
    }
    application.status = status;
    req.log.info({ event: 'application.status', applicationId: application.id, status }, 'application status changed');
    res.json(await db.saveApplication(application));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
