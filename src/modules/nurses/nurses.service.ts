/**
 * Nurses service — search, get, update, credential upload.
 * Matches nurseService.ts API surface.
 */
import path from 'path';
import db from '../../db';
import { createError } from '../../middleware/errorHandler';
import type { UserRow, NurseProfileRow, CredentialRow, AvailabilitySlotRow } from '../../types';

// ── Serialisers ────────────────────────────────────────────────────────────────

function specList(profile: NurseProfileRow): string[] {
  if (!profile.specializations) return [];
  return profile.specializations.split(',').map((s) => s.trim()).filter(Boolean);
}

function serializeProfile(
  profile: NurseProfileRow,
  user: UserRow,
  credentials: CredentialRow[],
  availability: AvailabilitySlotRow[]
) {
  return {
    id: profile.id,
    userId: profile.user_id,
    fullName: `${user.first_name} ${user.last_name}`,
    avatarUrl: user.avatar_url ?? null,
    specializations: specList(profile),
    yearsOfExperience: profile.years_of_experience,
    hourlyRate: profile.hourly_rate,
    bio: profile.bio ?? null,
    credentials: credentials.map((c) => ({
      id: c.id,
      name: c.name,
      issuingBody: c.issuing_body,
      issueDate: c.issue_date,
      expiryDate: c.expiry_date,
      documentUrl: c.document_url ?? null,
      status: c.status,
    })),
    rating: profile.rating,
    reviewCount: profile.review_count,
    availability: availability.map((a) => ({
      dayOfWeek: a.day_of_week,
      startTime: a.start_time,
      endTime: a.end_time,
    })),
    location: profile.location ?? null,
    isAvailable: profile.is_available,
  };
}

async function loadFull(profile: NurseProfileRow) {
  const [user, credentials, availability] = await Promise.all([
    db<UserRow>('users').where({ id: profile.user_id }).first() as Promise<UserRow>,
    db<CredentialRow>('credentials').where({ nurse_profile_id: profile.id }),
    db<AvailabilitySlotRow>('availability_slots').where({ nurse_profile_id: profile.id }),
  ]);
  return serializeProfile(profile, user, credentials, availability);
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchNurses(params: {
  serviceType?: string;
  location?: string;
  minRating?: number;
  maxHourlyRate?: number;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  let query = db<NurseProfileRow>('nurse_profiles');

  if (params.serviceType) {
    query = query.whereRaw('specializations ILIKE ?', [`%${params.serviceType}%`]);
  }
  if (params.location) {
    query = query.whereRaw('location ILIKE ?', [`%${params.location}%`]);
  }
  if (params.minRating !== undefined) {
    query = query.where('rating', '>=', params.minRating);
  }
  if (params.maxHourlyRate !== undefined) {
    query = query.where('hourly_rate', '<=', params.maxHourlyRate);
  }

  const [{ count }] = await query.clone().count<[{ count: string }]>('id as count');
  const total = parseInt(count, 10);

  const profiles = await query.offset(offset).limit(pageSize);
  const items = await Promise.all(profiles.map(loadFull));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ── Get by id ─────────────────────────────────────────────────────────────────

export async function getNurseById(id: string) {
  const profile = await db<NurseProfileRow>('nurse_profiles').where({ id }).first();
  if (!profile) throw createError('Nurse profile not found', 404);
  return loadFull(profile);
}

// ── Update profile ────────────────────────────────────────────────────────────

export async function updateNurseProfile(
  nurseId: string,
  currentUser: UserRow,
  data: Partial<{
    bio: string;
    yearsOfExperience: number;
    hourlyRate: number;
    location: string;
    isAvailable: boolean;
    specializations: string[];
  }>
) {
  const profile = await db<NurseProfileRow>('nurse_profiles').where({ id: nurseId }).first();
  if (!profile) throw createError('Nurse profile not found', 404);
  if (profile.user_id !== currentUser.id && currentUser.role !== 'admin') {
    throw createError('Not authorised to update this profile', 403);
  }

  const update: Record<string, unknown> = {};
  if (data.bio !== undefined) update.bio = data.bio;
  if (data.yearsOfExperience !== undefined) update.years_of_experience = data.yearsOfExperience;
  if (data.hourlyRate !== undefined) update.hourly_rate = data.hourlyRate;
  if (data.location !== undefined) update.location = data.location;
  if (data.isAvailable !== undefined) update.is_available = data.isAvailable;
  if (data.specializations !== undefined) update.specializations = data.specializations.join(',');

  await db('nurse_profiles').where({ id: nurseId }).update(update);
  const updated = await db<NurseProfileRow>('nurse_profiles').where({ id: nurseId }).first() as NurseProfileRow;
  return loadFull(updated);
}

// ── Upload credential ─────────────────────────────────────────────────────────

export async function uploadCredential(
  nurseId: string,
  currentUser: UserRow,
  fields: { name: string; issuingBody: string; issueDate: string; expiryDate: string },
  filePath: string
) {
  const profile = await db<NurseProfileRow>('nurse_profiles').where({ id: nurseId }).first();
  if (!profile) throw createError('Nurse profile not found', 404);
  if (profile.user_id !== currentUser.id && currentUser.role !== 'admin') {
    throw createError('Not authorised', 403);
  }

  const [cred] = await db<CredentialRow>('credentials')
    .insert({
      nurse_profile_id: profile.id,
      name: fields.name,
      issuing_body: fields.issuingBody,
      issue_date: fields.issueDate,
      expiry_date: fields.expiryDate,
      document_url: filePath,
      status: 'pending',
    })
    .returning('*');

  return {
    id: cred.id,
    name: cred.name,
    issuingBody: cred.issuing_body,
    issueDate: cred.issue_date,
    expiryDate: cred.expiry_date,
    documentUrl: cred.document_url,
    status: cred.status,
  };
}
