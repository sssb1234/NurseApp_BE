/**
 * Encryption helpers — thin wrappers around pgcrypto's pgp_sym_encrypt /
 * pgp_sym_decrypt so the rest of the codebase never touches raw SQL.
 *
 * All PII columns (phone, health vitals, TOTP secret) are stored as
 * pgp_sym_encrypt(value, key) ciphertext. The key lives only in .env.
 */
import db from './index';

const key = () => process.env.DB_ENCRYPTION_KEY ?? '';

/** Wrap a value in pgp_sym_encrypt for INSERT / UPDATE */
export function encryptExpr(value: string): string {
  // Returns a Knex raw fragment — caller must use db.raw(...)
  return `pgp_sym_encrypt(${db.client.formatter().wrap(value)}, '${key()}')`;
}

/**
 * Encrypt a plain string value and return the ciphertext ready to INSERT.
 * Use this when building parameterised queries.
 */
export async function encrypt(plain: string): Promise<string> {
  const row = await db.raw<{ rows: [{ v: string }] }>(
    'SELECT pgp_sym_encrypt(?, ?) AS v',
    [plain, key()]
  );
  return row.rows[0].v;
}

/**
 * Decrypt a ciphertext string from the DB.
 * Returns null when value is null / already plain (legacy rows).
 */
export async function decrypt(cipher: string | null): Promise<string | null> {
  if (!cipher) return null;
  try {
    const row = await db.raw<{ rows: [{ v: string }] }>(
      'SELECT pgp_sym_decrypt(?, ?) AS v',
      [cipher, key()]
    );
    return row.rows[0].v;
  } catch {
    // If decryption fails the value was stored plain — return as-is
    return cipher;
  }
}
