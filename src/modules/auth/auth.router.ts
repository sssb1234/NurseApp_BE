/**
 * Auth router — exactly matches the frontend authService.ts API contract:
 *
 *   POST /api/v1/auth/register
 *   POST /api/v1/auth/login
 *   POST /api/v1/auth/logout
 *   GET  /api/v1/auth/me
 *   POST /api/v1/auth/refresh
 *   POST /api/v1/auth/mfa/setup
 *   POST /api/v1/auth/mfa/confirm
 *   POST /api/v1/auth/mfa/verify
 *   GET  /api/v1/auth/oauth/google
 *   GET  /api/v1/auth/oauth/google/callback
 *   GET  /api/v1/auth/oauth/microsoft
 *   GET  /api/v1/auth/oauth/microsoft/callback
 */
import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import axios from 'axios';

import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { config } from '../../config';
import * as authService from './auth.service';
import logger from '../../utils/logger';


const router = Router();

// ── Register ───────────────────────────────────────────────────────────────────

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('role').isIn(['patient', 'nurse', 'admin','facility_admin']),
    body('phone').optional().isMobilePhone('any'),
  ],
  validate,
  async (req: Request, res: Response) => {
    const result = await authService.registerUser(req.body);
    res.status(201).json(result);
  }
);

// ── Login ──────────────────────────────────────────────────────────────────────

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  async (req: Request, res: Response) => {
    logger.info('req.body ', req.body);
    const result = await authService.loginUser(req.body);
    res.json(result);
  }
);

// ── Profile ────────────────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response) => {
  const profile = await authService.getProfile(req.user!);
  res.json(profile);
});

// ── Logout ─────────────────────────────────────────────────────────────────────

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  await authService.logoutUser(req.user!.id);
  res.status(204).end();
});

// ── Refresh token ──────────────────────────────────────────────────────────────

router.post(
  '/refresh',
  [body('refresh_token').notEmpty()],
  validate,
  async (req: Request, res: Response) => {
    const result = await authService.refreshAccessToken(req.body.refresh_token as string);
    res.json(result);
  }
);

// ── MFA setup ──────────────────────────────────────────────────────────────────

router.post('/mfa/setup', authenticate, async (req: Request, res: Response) => {
  const result = await authService.setupMfa(req.user!);
  res.json(result);
});

router.post(
  '/mfa/confirm',
  authenticate,
  [body('totp_code').isLength({ min: 6, max: 6 })],
  validate,
  async (req: Request, res: Response) => {
    await authService.confirmMfa(req.user!, req.body.totp_code as string);
    res.status(204).end();
  }
);

router.post(
  '/mfa/verify',
  [body('temp_token').notEmpty(), body('totp_code').isLength({ min: 6, max: 6 })],
  validate,
  async (req: Request, res: Response) => {
    const result = await authService.verifyMfaLogin(
      req.body.temp_token as string,
      req.body.totp_code as string
    );
    res.json(result);
  }
);

// ── OAuth 2.0 – Google ────────────────────────────────────────────────────────

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

router.get('/oauth/google', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: config.oauth.google.clientId,
    redirect_uri: config.oauth.google.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
  });
  res.json({ url: `${GOOGLE_AUTH_URL}?${params.toString()}` });
});

router.get('/oauth/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) { res.status(400).json({ success: false, message: 'Missing code' }); return; }

  const tokenResp = await axios.post(GOOGLE_TOKEN_URL, {
    code,
    client_id: config.oauth.google.clientId,
    client_secret: config.oauth.google.clientSecret,
    redirect_uri: config.oauth.google.redirectUri,
    grant_type: 'authorization_code',
  });
  const { access_token } = tokenResp.data as { access_token: string };

  const userResp = await axios.get(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const info = userResp.data as { sub: string; email: string; given_name: string; family_name: string; picture: string };

  const result = await authService.handleOAuthUser({
    email: info.email,
    firstName: info.given_name,
    lastName: info.family_name,
    avatarUrl: info.picture,
    provider: 'google',
    subject: info.sub,
  });
  res.json(result);
});

// ── OAuth 2.0 – Microsoft ─────────────────────────────────────────────────────

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_USERINFO_URL = 'https://graph.microsoft.com/v1.0/me';

router.get('/oauth/microsoft', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: config.oauth.microsoft.clientId,
    redirect_uri: config.oauth.microsoft.redirectUri,
    response_type: 'code',
    scope: 'openid email profile User.Read',
    response_mode: 'query',
  });
  res.json({ url: `${MS_AUTH_URL}?${params.toString()}` });
});

router.get('/oauth/microsoft/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) { res.status(400).json({ success: false, message: 'Missing code' }); return; }

  const tokenResp = await axios.post(
    MS_TOKEN_URL,
    new URLSearchParams({
      code,
      client_id: config.oauth.microsoft.clientId,
      client_secret: config.oauth.microsoft.clientSecret,
      redirect_uri: config.oauth.microsoft.redirectUri,
      grant_type: 'authorization_code',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const { access_token } = tokenResp.data as { access_token: string };

  const userResp = await axios.get(MS_USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const info = userResp.data as {
    id: string; mail?: string; userPrincipalName?: string;
    givenName?: string; surname?: string; displayName?: string;
  };

  const result = await authService.handleOAuthUser({
    email: (info.mail || info.userPrincipalName)!,
    firstName: info.givenName || info.displayName || '',
    lastName: info.surname || '',
    provider: 'microsoft',
    subject: info.id,
  });
  res.json(result);
});

export default router;
