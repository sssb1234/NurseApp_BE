import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  appName: process.env.APP_NAME || 'NursesCare Platform API',

  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173' || 'http://localhost:3000' || 'http://localhost:5000')
    .split(',')
    .map((o) => o.trim()),

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  },
  refreshToken: {
    secret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret',
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  mfa: {
    issuer: process.env.MFA_ISSUER || 'NursesCare',
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/oauth/google/callback',
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/oauth/microsoft/callback',
    },
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 10,
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },
};
