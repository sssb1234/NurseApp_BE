import knex from 'knex';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const env = process.env.NODE_ENV || 'production';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const knexConfig = require('./knexfile')[env];

const db = knex(knexConfig);

logger.info("NODE_ENV = ", process.env.NODE_ENV);
logger.info("DATABASE_URL exists = ", !!process.env.DATABASE_URL);
logger.info("DB_HOST = ", process.env.DB_HOST);
logger.info("knexConfig ",knexConfig.connection);

export default db;
