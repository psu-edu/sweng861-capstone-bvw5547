// Express app. Logging, metrics, health, docs, routes, and the error handler.
// index.js connects to the database and listens.
const express = require('express');
const cookieParser = require('cookie-parser');
require('dotenv').config({ quiet: true });
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const db = require('./db');
const auth = require('./auth');
const profiles = require('./routes/profiles');
const jobs = require('./routes/jobs');
const applications = require('./routes/applications');
const { requestLogger } = require('./logger');
const { metricsMiddleware, metricsHandler } = require('./metrics');

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(requestLogger);
app.use(metricsMiddleware);
app.use(express.json());
app.use(cookieParser());

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check with database status
 *     responses:
 *       200: { description: App and database are up }
 *       503: { description: Database is not reachable }
 */
function health(_req, res) {
  const dbState = db.isConnected() ? 'UP' : 'DOWN';
  res.status(dbState === 'UP' ? 200 : 503).json({ status: dbState, db: dbState });
}
app.get('/health', health);
app.get('/health/ready', health);
app.get('/health/live', (_req, res) => {
  res.json({ status: 'UP' });
});

app.get('/metrics', metricsHandler);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

app.use('/auth', auth.router);
app.use('/api/profiles', profiles);
app.use('/api/jobs', jobs);
app.use('/api/applications', applications);

const statusNames = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  502: 'Bad Gateway',
  503: 'Service Unavailable'
};

app.use((error, req, res, _next) => {
  let status = error.status || 500;
  let message = error.message;
  if (error.name === 'ValidationError') status = 400;
  if (error.code === 11000) {
    status = 409;
    message = 'That record already exists';
  }
  if (status >= 500) req.log.error({ err: error, event: 'request.failed' }, 'unexpected error');
  if (status === 500) message = 'Something went wrong';
  res.status(status).json({ error: statusNames[status] || 'Internal Server Error', message });
});

module.exports = app;
