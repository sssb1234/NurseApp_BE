/**
 * Bookings service — create, list, get, cancel, confirm.
 * Matches bookingService.ts API surface exactly.
 */
import db from '../../db';
import { createError } from '../../middleware/errorHandler';
import type { UserRow, NurseProfileRow, BookingRow, ServiceType,BookingStatus } from '../../types';

// ── Serialiser ────────────────────────────────────────────────────────────────

async function serializeBooking(booking: BookingRow) {
  const nurse = await db<NurseProfileRow>('nurse_profiles').where({ id: booking.nurse_id }).first() as NurseProfileRow;
  const nurseUser = await db<UserRow>('users').where({ id: nurse.user_id }).first() as UserRow;

  return {
    id: booking.id,
    patientId: booking.patient_id,
    nurseId: booking.nurse_id,
    nurseName: `${nurseUser.first_name} ${nurseUser.last_name}`,
    serviceType: booking.service_type,
    status: booking.status,
    startDate: booking.start_date,
    endDate: booking.end_date,
    hours: booking.hours,
    totalAmount: booking.total_amount,
    notes: booking.notes ?? undefined,
    address: booking.address,
    createdAt: booking.created_at,
  };
}

// ── Create booking ────────────────────────────────────────────────────────────

export async function createBooking(
  currentUser: UserRow,
  body: {
    nurseId: string;
    serviceType: ServiceType;
    startDate: string;
    endDate: string;
    hours: number;
    address: string;
    notes?: string;
  }
) {
  const nurse = await db<NurseProfileRow>('nurse_profiles').where({ id: body.nurseId }).first();
  if (!nurse) throw createError('Nurse profile not found', 400);

  const totalAmount = nurse.hourly_rate * body.hours;

  const [booking] = await db<BookingRow>('bookings')
    .insert({
      patient_id: currentUser.id,
      nurse_id: nurse.id,
      service_type: body.serviceType,
      start_date: body.startDate,
      end_date: body.endDate,
      hours: body.hours,
      total_amount: totalAmount,
      address: body.address,
      notes: body.notes ?? null,
      status: 'pending',
    })
    .returning('*');

  return serializeBooking(booking);
}

// ── Get my bookings ───────────────────────────────────────────────────────────

export async function getMyBookings(currentUser: UserRow) {
  const bookings = await db<BookingRow>('bookings')
    .where({ patient_id: currentUser.id })
    .orderBy('created_at', 'desc');
  return Promise.all(bookings.map(serializeBooking));
}

// ── Get single booking ────────────────────────────────────────────────────────

export async function getBookingById(id: string, currentUser: UserRow) {
  const booking = await db<BookingRow>('bookings').where({ id }).first();
  if (!booking) throw createError('Booking not found', 404);

  const isOwner = booking.patient_id === currentUser.id;
  const isPrivileged = ['admin', 'facility_admin'].includes(currentUser.role);
  if (!isOwner && !isPrivileged) throw createError('Access denied', 403);

  return serializeBooking(booking);
}

// ── Status transitions ────────────────────────────────────────────────────────

async function transitionBooking(
  id: string,
  currentUser: UserRow,
  newStatus: BookingStatus,
  allowedFrom: string[]
) {
  const booking = await db<BookingRow>('bookings').where({ id }).first();
  if (!booking) throw createError('Booking not found', 404);

  if (!allowedFrom.includes(booking.status)) {
    throw createError(`Cannot transition from '${booking.status}' to '${newStatus}'`, 400);
  }

  const isPatient = booking.patient_id === currentUser.id;
  const isPrivileged = ['admin', 'nurse'].includes(currentUser.role);
  if (!isPatient && !isPrivileged) throw createError('Access denied', 403);

  const [updated] = await db<BookingRow>('bookings')
    .where({ id })
    .update({ status: newStatus })
    .returning('*');

  return serializeBooking(updated);
}

export async function cancelBooking(id: string, currentUser: UserRow) {
  return transitionBooking(id, currentUser, 'cancelled', ['pending', 'confirmed']);
}

export async function confirmBooking(id: string, currentUser: UserRow) {
  return transitionBooking(id, currentUser, 'confirmed', ['pending']);
}
