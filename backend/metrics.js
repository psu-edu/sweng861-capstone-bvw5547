// Prometheus metrics. Request counts and latency per route, plus domain counters.
const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests by method, route, and status',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

const jobsCreated = new client.Counter({
  name: 'jobs_created_total',
  help: 'Openings posted by professors',
  registers: [register]
});

const applicationsTotal = new client.Counter({
  name: 'applications_total',
  help: 'Application attempts by outcome',
  labelNames: ['outcome'],
  registers: [register]
});

const loginAttempts = new client.Counter({
  name: 'login_attempts_total',
  help: 'Login attempts by provider and result',
  labelNames: ['provider', 'result'],
  registers: [register]
});

const linkedinShares = new client.Counter({
  name: 'linkedin_shares_total',
  help: 'Openings shared to LinkedIn by result',
  labelNames: ['result'],
  registers: [register]
});

// Uses the express route pattern so ids do not create new label values.
function routeLabel(req) {
  if (req.route) return (req.baseUrl || '') + req.route.path;
  return 'unmatched';
}

function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: routeLabel(req), status: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    end(labels);
  });
  next();
}

async function metricsHandler(_req, res) {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
}

module.exports = { metricsMiddleware, metricsHandler, jobsCreated, applicationsTotal, loginAttempts, linkedinShares };
