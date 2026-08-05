/**
 * Bookings router — matches bookingService.ts:
 *   POST  /api/v1/bookings
 *   GET   /api/v1/bookings/me
 *   GET   /api/v1/bookings/:id
 *   PATCH /api/v1/bookings/:id/cancel
 *   PATCH /api/v1/bookings/:id/confirm
 */
import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as bookingsService from './bookings.service';

const router = Router();

router.use(authenticate);

// ── Create ────────────────────────────────────────────────────────────────────

router.post(
  '/',
  [
    body('nurseId').isUUID(),
    body('serviceType').isIn([
      'home_care', 'hospital_support', 'elderly_care',
      'companion_service', 'post_surgical', 'pediatric_care',
    ]),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('hours').isInt({ min: 1 }),
    body('address').notEmpty().trim(),
    body('notes').optional().isString(),
  ],
  validate,
  async (req: Request, res: Response) => {
    const result = await bookingsService.createBooking(req.user!, req.body);
    res.status(201).json(result);
  }
);

// ── My bookings (must be before /:id) ────────────────────────────────────────

router.get('/me', async (req: Request, res: Response) => {
  const result = await bookingsService.getMyBookings(req.user!);
  res.json(result);
});

// ── Get single ────────────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  const result = await bookingsService.getBookingById(req.params.id, req.user!);
  res.json(result);
});

// ── Cancel ────────────────────────────────────────────────────────────────────

router.patch('/:id/cancel', async (req: Request, res: Response) => {
  const result = await bookingsService.cancelBooking(req.params.id, req.user!);
  res.json(result);
});

// ── Confirm ───────────────────────────────────────────────────────────────────

router.patch('/:id/confirm', async (req: Request, res: Response) => {
  const result = await bookingsService.confirmBooking(req.params.id, req.user!);
  res.json(result);
});

export default router;
