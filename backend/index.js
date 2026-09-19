// Server entry point. Connects to MongoDB, then listens.
const app = require('./app');
const { initializeDatabase } = require('./db');
const { logger } = require('./logger');

const PORT = process.env.PORT || 3000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'server started');
    });
  })
  .catch((error) => {
    logger.fatal({ err: error }, 'database initialization failed');
    process.exit(1);
  });
