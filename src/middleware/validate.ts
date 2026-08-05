import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/** Sends 422 with all validation errors if any exist. */
export function validate(req: Request, res: Response, next: NextFunction): void {
  //console.log('in err ',req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
    return;
  }
  next();
}
