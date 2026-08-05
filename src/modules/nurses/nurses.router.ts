/**
 * Nurses router — matches nurseService.ts:
 *   GET  /api/v1/nurses
 *   GET  /api/v1/nurses/:id
 *   PUT  /api/v1/nurses/:id
 *   POST /api/v1/nurses/:id/credentials
 */
import { Router, Request, Response } from 'express';
import { body, query as qv } from 'express-validator';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { upload } from '../../middleware/upload';
import * as nursesService from './nurses.service';

const router = Router();

router.use(authenticate);

// ── Search ────────────────────────────────────────────────────────────────────

router.get(
  '/',
  [
    qv('page').optional().isInt({ min: 1 }).toInt(),
    qv('pageSize').optional().isInt({ min: 1, max: 50 }).toInt(),
    qv('minRating').optional().isFloat({ min: 0, max: 5 }).toFloat(),
    qv('maxHourlyRate').optional().isFloat({ min: 0 }).toFloat(),
  ],
  validate,
  async (req: Request, res: Response) => {
    const result = await nursesService.searchNurses({
      serviceType: req.query.serviceType as string | undefined,
      location: req.query.location as string | undefined,
      minRating: req.query.minRating as unknown as number | undefined,
      maxHourlyRate: req.query.maxHourlyRate as unknown as number | undefined,
      page: req.query.page as unknown as number | undefined,
      pageSize: req.query.pageSize as unknown as number | undefined,
    });
    res.json(result);
  }
);

// ── Get by id ─────────────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  const result = await nursesService.getNurseById(req.params.id);
  res.json(result);
});

// ── Update profile ────────────────────────────────────────────────────────────

router.put(
  '/:id',
  [
    body('bio').optional().isString(),
    body('hourlyRate').optional().isFloat({ min: 0 }),
    body('yearsOfExperience').optional().isInt({ min: 0 }),
    body('isAvailable').optional().isBoolean(),
  ],
  validate,
  async (req: Request, res: Response) => {
    const result = await nursesService.updateNurseProfile(
      req.params.id,
      req.user!,
      req.body as Parameters<typeof nursesService.updateNurseProfile>[2]
    );
    res.json(result);
  }
);

// ── Upload credential ─────────────────────────────────────────────────────────

router.post(
  '/:id/credentials',
  upload.single('file'),
  [
    body('name').notEmpty().trim(),
    body('issuingBody').notEmpty().trim(),
    body('issueDate').isISO8601().toDate(),
    body('expiryDate').isISO8601().toDate(),
  ],
  validate,
  async (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ success: false, message: 'File is required' }); return; }
    const result = await nursesService.uploadCredential(
      req.params.id,
      req.user!,
      req.body as { name: string; issuingBody: string; issueDate: string; expiryDate: string },
      req.file.path
    );
    res.status(201).json(result);
  }
);

export default router;
