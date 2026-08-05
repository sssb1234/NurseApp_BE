/**
 * JWT helpers — access tokens (short-lived) and refresh tokens (long-lived,
 * stored hashed in the DB).
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';

export interface AccessTokenPayload {
  sub: string;        // user id
  role: string;
  type: 'access' | 'mfa_pending';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

// ── Access token ──────────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
  );
}

export function signMfaPendingToken(sub: string): string {
  return jwt.sign({ sub, type: 'mfa_pending' }, config.jwt.secret, { expiresIn: '5m' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.secret) as AccessTokenPayload;
}

// ── Refresh token ─────────────────────────────────────────────────────────────

export function signRefreshToken(sub: string): string {
  return jwt.sign(
    { sub, type: 'refresh' },
    config.refreshToken.secret,
    { expiresIn: config.refreshToken.expiresIn } as jwt.SignOptions
  );
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.refreshToken.secret) as RefreshTokenPayload;
}

// ── Token hashing (for safe DB storage) ──────────────────────────────────────

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ── Expiry helper ─────────────────────────────────────────────────────────────

export function refreshTokenExpiresAt(): Date {
  const days = parseInt(config.refreshToken.expiresIn, 10) || 7;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
