/**
 * Express application factory.
 * Separated from server.ts so tests can import the app without binding a port.
 */
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './modules/auth/auth.router';
import nursesRouter from './modules/nurses/nurses.router';
import bookingsRouter from './modules/bookings/bookings.router';
import healthMetricsRouter from './modules/health-metrics/health-metrics.router';
import logger from './utils/logger';

const app = express();

// ── Security & utility middleware ─────────────────────────────────────────────
//app.set("trustProxy", false);
app.use(helmet());
app.use(cors({
  origin: "https://nurse-app-fe-nine.vercel.app",
  //credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(compression());
app.use(express.json());
//app.use(express.urlencoded({ extended: true }));

if (config.env !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/nurses', nursesRouter);
app.use('/api/v1/bookings', bookingsRouter);
app.use('/api/v1/health-metrics', healthMetricsRouter);

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', service: config.appName });
});

// ── 404 ───────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use(errorHandler);

export default app;
