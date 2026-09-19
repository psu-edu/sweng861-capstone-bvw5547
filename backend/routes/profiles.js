// Profile routes. A user reads and updates their own profile. A professor may read the
// profile of a student who applied to one of their openings.
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { validateProfile } = require('../rules');

const router = express.Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/profiles/me:
 *   get:
 *     tags: [Profiles]
 *     summary: Read my profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The profile, or an empty profile when none is saved yet }
 *   put:
 *     tags: [Profiles]
 *     summary: Create or update my profile
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               major: { type: string }
 *               gpa: { type: number }
 *               skills: { type: array, items: { type: string } }
 *               resumeUrl: { type: string }
 *               department: { type: string }
 *               contact: { type: string }
 *     responses:
 *       200: { description: Saved profile }
 *       400: { description: Invalid input }
 */
router.get('/me', async (req, res, next) => {
  try {
    const profile = await db.getProfile(req.user.id);
    res.json(profile || { userId: req.user.id, skills: [] });
  } catch (error) {
    next(error);
  }
});

router.put('/me', async (req, res, next) => {
  try {
    const { errors, value } = validateProfile(req.user.role, req.body);
    if (errors.length) return res.status(400).json({ error: 'Bad Request', message: errors[0], errors });
    const profile = await db.upsertProfile(req.user.id, value);
    req.log.info({ event: 'profile.saved', userId: req.user.id }, 'profile saved');
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/profiles/{userId}:
 *   get:
 *     tags: [Profiles]
 *     summary: Read an applicant profile (professor, own openings only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The profile }
 *       403: { description: The student has not applied to one of your openings }
 *       404: { description: No such profile }
 */
router.get('/:userId', async (req, res, next) => {
  try {
    if (req.user.role !== 'professor') {
      return res.status(403).json({ error: 'Forbidden', message: 'Requires professor role' });
    }
    const applications = await db.listApplications({ studentId: req.params.userId });
    const jobs = await db.listJobs({ professorId: req.user.id });
    const jobIds = new Set(jobs.map((job) => job.id));
    if (!applications.some((application) => jobIds.has(application.jobId))) {
      return res.status(403).json({ error: 'Forbidden', message: 'This student has not applied to one of your openings' });
    }
    const profile = await db.getProfile(req.params.userId);
    if (!profile) return res.status(404).json({ error: 'Not Found', message: 'Profile does not exist' });
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
