import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const env = process.env.NODE_ENV || 'production';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const knexConfig = require('./knexfile')[env];

const db = knex(knexConfig);

console.log("NODE_ENV =", process.env.NODE_ENV);
console.log("DATABASE_URL exists =", !!process.env.DATABASE_URL);
console.log("DB_HOST =", process.env.DB_HOST);

console.log(knexConfig.connection);

export default db;
