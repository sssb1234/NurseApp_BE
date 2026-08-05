import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'db.ezxbaqrdcjocgpzivsdi.supabase.co',
      port: Number(process.env.DB_PORT) || 6543,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'R3100k6HULKQhJPv',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
    pool: { min: 2, max: 10 },
  },
  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME ? `${process.env.DB_NAME}_test` : 'ncp_db_test',
      user: process.env.DB_USER || 'ncp_user',
      password: process.env.DB_PASSWORD || 'ncp_pass',
    },
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: true },
    },
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
    pool: { min: 2, max: 20 },
  },
};

export default config;
module.exports = config;
