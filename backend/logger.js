// Structured JSON logging with pino. One logger for the app and one middleware for requests.
// Request logs carry a request id, method, url, status, and response time. Headers are not logged.
const pino = require('pino');
const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'campus-works-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) }
});

const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = req.headers['x-request-id'] || randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  autoLogging: {
    ignore: (req) => req.url.startsWith('/health') || req.url === '/metrics'
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.originalUrl} ${res.statusCode}`,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.raw.originalUrl || req.url }),
    res: (res) => ({ statusCode: res.statusCode })
  }
});

module.exports = { logger, requestLogger };
