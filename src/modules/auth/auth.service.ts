/**
 * Auth service — register, login, MFA, OAuth, refresh, logout.
 * Keeps all DB + crypto logic out of the router.
 */
import db from '../../db';
import { encrypt, decrypt } from '../../db/crypto';
import { hashPassword, verifyPassword } from '../../utils/password';
import {
  signAccessToken, signRefreshToken, signMfaPendingToken,
  verifyRefreshToken, hashToken, refreshTokenExpiresAt,
} from '../../utils/jwt';
import {
  generateTotpSecret, getTotpUri, getTotpQrBase64, verifyTotp,
} from '../../utils/mfa';
import { createError } from '../../middleware/errorHandler';
import type { UserRow, MfaConfigRow } from '../../types';
import logger from '../../utils/logger';

// ── Shared serialiser ──────────────────────────────────────────────────────────

export function serializeUser(u: UserRow, phone?: string | null) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    phone: phone ?? undefined,
    //avatarUrl: u.avatar_url ?? undefined,
    createdAt: u.created_at,
    isVerified: u.is_verified,
  };
}

// ── Register ───────────────────────────────────────────────────────────────────

export async function registerUser(body: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'patient' | 'nurse' | 'admin' | 'facility_admin';
  phone?: string;
}) {
  logger.info('db ', db);
  const existing = await db<UserRow>('users').where({ email: body.email.toLowerCase() }).first();
  if (existing) throw createError('An account with this email already exists', 409);

  //const hashed_password = await hashPassword(body.password);
  //const encrypted_phone = body.phone ? await encrypt(body.phone) : null;
  const hashed_password = await hashPassword(body.password);
  const encrypted_phone = body.phone;

  const [user] = await db<UserRow>('users')
    .insert({
      email: body.email.toLowerCase(),
      hashed_password,
      first_name: body.firstName,
      last_name: body.lastName,
      phone: encrypted_phone,
      role: body.role,
    })
    .returning('*');

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const rawRefresh = signRefreshToken(user.id);
 // await storeRefreshToken(user.id, rawRefresh);

  return {
    user: serializeUser(user, body.phone),
    token: accessToken,
    refresh_token: rawRefresh,
    mfa_required: false,
  };
}

// ── Login ──────────────────────────────────────────────────────────────────────

export async function loginUser(body: { email: string; password: string }) {
  const user = await db<UserRow>('users').where({ email: body.email.toLowerCase() }).first();
  if (!user || !user.hashed_password) throw createError('Invalid credentials', 401);
  if (!user.is_active) throw createError('Account is inactive', 403);

  const valid = await verifyPassword(body.password, user.hashed_password);
  if (!valid) throw createError('Invalid credentials', 401);

  if (user.mfa_enabled) {
    const tempToken = signMfaPendingToken(user.id);
    return {
      user: serializeUser(user),
      token: tempToken,
      mfa_required: true,
    };
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const rawRefresh = signRefreshToken(user.id);
  //await storeRefreshToken(user.id, rawRefresh);

  return {
    user: serializeUser(user),
    token: accessToken,
    refresh_token: rawRefresh,
    mfa_required: false,
  };
}

// ── Logout ─────────────────────────────────────────────────────────────────────

export async function logoutUser(userId: string): Promise<void> {
  await db('refresh_tokens')
    .where({ user_id: userId, revoked: false })
    .update({ revoked: true });
}

// ── Get profile ────────────────────────────────────────────────────────────────

export async function getProfile(user: UserRow) {
  const phone = await decrypt(user.phone);
  return serializeUser(user, phone);
}

// ── Refresh token ──────────────────────────────────────────────────────────────

export async function refreshAccessToken(rawRefresh: string) {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefresh);
  } catch {
    throw createError('Invalid refresh token', 401);
  }

  const hashed = hashToken(rawRefresh);
  const stored = await db('refresh_tokens')
    .where({ token_hash: hashed, revoked: false })
    .first();

  if (!stored || new Date(stored.expires_at) < new Date()) {
    throw createError('Refresh token expired or revoked', 401);
  }

  // Rotate
  await db('refresh_tokens').where({ id: stored.id }).update({ revoked: true });

  const user = await db<UserRow>('users').where({ id: payload.sub }).first();
  if (!user) throw createError('User not found', 401);

  const newAccess = signAccessToken({ sub: user.id, role: user.role });
  const newRefresh = signRefreshToken(user.id);
  await storeRefreshToken(user.id, newRefresh);

  return { token: newAccess, refresh_token: newRefresh };
}

// ── MFA setup ──────────────────────────────────────────────────────────────────

export async function setupMfa(user: UserRow) {
  const secret = generateTotpSecret();
  const uri = getTotpUri(user.email, secret);
  const qrBase64 = await getTotpQrBase64(uri);

  const encryptedSecret = await encrypt(secret);
  const existing = await db<MfaConfigRow>('mfa_configs').where({ user_id: user.id }).first();

  if (existing) {
    await db('mfa_configs')
      .where({ user_id: user.id })
      .update({ totp_secret: encryptedSecret, is_confirmed: false });
  } else {
    await db('mfa_configs').insert({
      user_id: user.id,
      totp_secret: encryptedSecret,
      is_confirmed: false,
    });
  }

  return { provisioning_uri: uri, qr_code_base64: qrBase64 };
}

export async function confirmMfa(user: UserRow, totpCode: string): Promise<void> {
  const cfg = await db<MfaConfigRow>('mfa_configs').where({ user_id: user.id }).first();
  if (!cfg?.totp_secret) throw createError('MFA not initialised', 400);

  const secret = await decrypt(cfg.totp_secret);
  if (!secret || !verifyTotp(totpCode, secret)) {
    throw createError('Invalid TOTP code', 400);
  }

  await db('mfa_configs').where({ user_id: user.id }).update({ is_confirmed: true });
  await db('users').where({ id: user.id }).update({ mfa_enabled: true });
}

export async function verifyMfaLogin(tempToken: string, totpCode: string) {
  // tempToken is a short-lived JWT with type=mfa_pending
  let payload: { sub: string; type: string };
  try {
    const { verifyAccessToken } = await import('../../utils/jwt');
    payload = verifyAccessToken(tempToken) as { sub: string; type: string };
  } catch {
    throw createError('Invalid session token', 401);
  }
  if (payload.type !== 'mfa_pending') throw createError('Token not suitable for MFA', 401);

  const user = await db<UserRow>('users').where({ id: payload.sub }).first();
  if (!user) throw createError('User not found', 401);

  const cfg = await db<MfaConfigRow>('mfa_configs').where({ user_id: user.id }).first();
  if (!cfg?.totp_secret) throw createError('MFA not configured', 400);

  const secret = await decrypt(cfg.totp_secret);
  if (!secret || !verifyTotp(totpCode, secret)) {
    throw createError('Invalid TOTP code', 401);
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const rawRefresh = signRefreshToken(user.id);
  await storeRefreshToken(user.id, rawRefresh);

  return {
    user: serializeUser(user),
    token: accessToken,
    refresh_token: rawRefresh,
    mfa_required: false,
  };
}

// ── OAuth helpers ──────────────────────────────────────────────────────────────

export async function handleOAuthUser(info: {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  provider: string;
  subject: string;
}) {
  let user = await db<UserRow>('users').where({ email: info.email.toLowerCase() }).first();

  if (!user) {
    const [created] = await db<UserRow>('users')
      .insert({
        email: info.email.toLowerCase(),
        first_name: info.firstName,
        last_name: info.lastName,
        //avatar_url: info.avatarUrl ?? null,
        oauth_provider: info.provider,
        oauth_subject: info.subject,
        is_verified: true,
        role: 'patient',
      })
      .returning('*');
    user = created;
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const rawRefresh = signRefreshToken(user.id);
  await storeRefreshToken(user.id, rawRefresh);

  return {
    user: serializeUser(user),
    token: accessToken,
    refresh_token: rawRefresh,
    mfa_required: false,
  };
}

// ── Internal ───────────────────────────────────────────────────────────────────

async function storeRefreshToken(userId: string, raw: string): Promise<void> {
  await db('refresh_tokens').insert({
    user_id: userId,
    token_hash: hashToken(raw),
    expires_at: refreshTokenExpiresAt(),
  });
}
