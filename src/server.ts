import app from './app';
import { config } from './config';
import db from './db';
import logger from './utils/logger';

async function start() {
  try {
    // Verify DB connection
    await db.raw('SELECT 1');
    logger.info('Database connection established');

    app.listen(config.port, () => {
      logger.info(`${config.appName} running on http://localhost:${config.port}`);
      logger.info(`API docs: http://localhost:${config.port}/api/v1`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
