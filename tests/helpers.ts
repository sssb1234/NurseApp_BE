/**
 * Test helpers shared across all test suites.
 *
 * Uses a real PostgreSQL test database (ncp_db_test).
 * Run: createdb ncp_db_test  before the first run.
 */
import db from '../src/db';

export async function resetDb() {
  // Delete in FK-safe order
  await db('mfa_configs').del();
  await db('refresh_tokens').del();
  await db('health_metrics').del();
  await db('bookings').del();
  await db('availability_slots').del();
  await db('credentials').del();
  await db('nurse_profiles').del();
  await db('users').del();
}

export async function closeDb() {
  await db.destroy();
}
