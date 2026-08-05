/**
 * Health metrics router:
 *   GET  /api/v1/health-metrics/me
 *   POST /api/v1/health-metrics
 */
import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as healthService from './health-metrics.service';

const router = Router();

router.use(authenticate);

router.get('/me', async (req: Request, res: Response) => {
  const result = await healthService.getMyMetrics(req.user!);
  res.json(result);
});

router.post(
  '/',
  [
    body('date').isISO8601(),
    body('heartRate').optional().isFloat({ min: 0 }),
    body('bloodPressureSystolic').optional().isFloat({ min: 0 }),
    body('bloodPressureDiastolic').optional().isFloat({ min: 0 }),
    body('oxygenSaturation').optional().isFloat({ min: 0, max: 100 }),
    body('temperature').optional().isFloat({ min: 30, max: 45 }),
    body('weight').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    const result = await healthService.upsertMetric(req.user!, req.body);
    res.status(201).json(result);
  }
);

export default router;
