import type { Knex } from 'knex';

/**
 * Migration 001 — Initial schema
 *
 * Enables pgcrypto for column-level AES-256 encryption on PII fields:
 *   - users.phone
 *   - health_metrics vitals (GDPR special-category data)
 *   - mfa_configs.totp_secret
 */
export async function up(knex: Knex): Promise<void> {
  // pgcrypto extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  // ── ENUM types ───────────────────────────────────────────────────────────
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('patient','nurse','carer','facility_admin','admin');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE verification_status AS ENUM ('pending','verified','rejected');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE service_type AS ENUM (
        'home_care','hospital_support','elderly_care',
        'companion_service','post_surgical','pediatric_care'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE booking_status AS ENUM (
        'pending','confirmed','in_progress','completed','cancelled'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);

  // ── users ────────────────────────────────────────────────────────────────
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('email', 255).notNullable().unique();
    t.string('hashed_password', 255).nullable();          // null for OAuth-only
    t.string('first_name', 100).notNullable();
    t.string('last_name', 100).notNullable();
    t.text('phone').nullable();                           // pgcrypto-encrypted
    t.specificType('role', 'user_role').notNullable().defaultTo('patient');
    t.string('avatar_url', 512).nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.boolean('is_verified').notNullable().defaultTo(false);
    t.boolean('mfa_enabled').notNullable().defaultTo(false);
    t.string('oauth_provider', 50).nullable();
    t.string('oauth_subject', 255).nullable();
    t.timestamps(true, true);
  });

  // ── nurse_profiles ───────────────────────────────────────────────────────
  await knex.schema.createTable('nurse_profiles', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').unique();
    t.text('bio').nullable();
    t.integer('years_of_experience').notNullable().defaultTo(0);
    t.float('hourly_rate').notNullable().defaultTo(0);
    t.string('location', 255).nullable();
    t.boolean('is_available').notNullable().defaultTo(true);
    t.float('rating').notNullable().defaultTo(0);
    t.integer('review_count').notNullable().defaultTo(0);
    t.string('specializations', 512).nullable();          // comma-separated
    t.timestamps(true, true);
  });

  // ── credentials ──────────────────────────────────────────────────────────
  await knex.schema.createTable('credentials', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('nurse_profile_id').notNullable().references('id').inTable('nurse_profiles').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.string('issuing_body', 255).notNullable();
    t.string('issue_date', 10).notNullable();
    t.string('expiry_date', 10).notNullable();
    t.string('document_url', 512).nullable();
    t.specificType('status', 'verification_status').notNullable().defaultTo('pending');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── availability_slots ───────────────────────────────────────────────────
  await knex.schema.createTable('availability_slots', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('nurse_profile_id').notNullable().references('id').inTable('nurse_profiles').onDelete('CASCADE');
    t.integer('day_of_week').notNullable();
    t.string('start_time', 5).notNullable();
    t.string('end_time', 5).notNullable();
  });

  // ── bookings ─────────────────────────────────────────────────────────────
  await knex.schema.createTable('bookings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('patient_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index();
    t.uuid('nurse_id').notNullable().references('id').inTable('nurse_profiles').onDelete('CASCADE').index();
    t.specificType('service_type', 'service_type').notNullable();
    t.specificType('status', 'booking_status').notNullable().defaultTo('pending');
    t.string('start_date', 10).notNullable();
    t.string('end_date', 10).notNullable();
    t.integer('hours').notNullable();
    t.float('total_amount').notNullable();
    t.string('address', 512).notNullable();
    t.text('notes').nullable();
    t.timestamps(true, true);
  });

  // ── health_metrics ───────────────────────────────────────────────────────
  await knex.schema.createTable('health_metrics', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index();
    t.string('date', 10).notNullable();
    // All vitals encrypted at rest via pgp_sym_encrypt
    t.text('heart_rate').nullable();
    t.text('blood_pressure_systolic').nullable();
    t.text('blood_pressure_diastolic').nullable();
    t.text('oxygen_saturation').nullable();
    t.text('temperature').nullable();
    t.text('weight').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE UNIQUE INDEX uq_health_metrics_user_date ON health_metrics(user_id, date)');

  // ── refresh_tokens ───────────────────────────────────────────────────────
  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index();
    t.string('token_hash', 255).notNullable().unique();
    t.timestamp('expires_at').notNullable();
    t.boolean('revoked').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── mfa_configs ──────────────────────────────────────────────────────────
  await knex.schema.createTable('mfa_configs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').unique();
    t.text('totp_secret').nullable();                     // pgcrypto-encrypted
    t.boolean('is_confirmed').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mfa_configs');
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('health_metrics');
  await knex.schema.dropTableIfExists('bookings');
  await knex.schema.dropTableIfExists('availability_slots');
  await knex.schema.dropTableIfExists('credentials');
  await knex.schema.dropTableIfExists('nurse_profiles');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS booking_status');
  await knex.raw('DROP TYPE IF EXISTS service_type');
  await knex.raw('DROP TYPE IF EXISTS verification_status');
  await knex.raw('DROP TYPE IF EXISTS user_role');
}
