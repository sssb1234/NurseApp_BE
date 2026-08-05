import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  logger.error(`${req.method} ${req.path} → ${statusCode}: ${err.message}`, { stack: err.stack });

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal server error' : err.message,
  });
}

/** Shorthand to create an error with a custom HTTP status. */
export function createError(message: string, statusCode: number): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  return err;
}
