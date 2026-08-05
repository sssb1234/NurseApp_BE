import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const env = process.env.NODE_ENV || 'production';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const knexConfig = require('./knexfile')[env];

const db = knex(knexConfig);

export default db;
