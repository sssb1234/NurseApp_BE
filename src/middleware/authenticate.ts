import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import db from '../db';
import type { UserRow } from '../types';

/** Attaches req.user from the Bearer JWT. Returns 401 on failure. */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Missing authorization header' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') {
      res.status(401).json({ success: false, message: 'Invalid token type' });
      return;
    }

    const user = await db<UserRow>('users').where({ id: payload.sub }).first();
    if (!user || !user.is_active) {
      res.status(401).json({ success: false, message: 'User not found or inactive' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/** Factory: restrict route to one or more roles. */
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
