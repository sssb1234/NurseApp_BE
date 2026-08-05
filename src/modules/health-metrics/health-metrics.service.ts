/**
 * Health metrics service — upsert (by user+date) and list.
 * All vitals are stored encrypted via pgcrypto.
 */
import db from '../../db';
import { encrypt, decrypt } from '../../db/crypto';
import type { UserRow, HealthMetricRow } from '../../types';

// ── Serialiser ─────────────────────────────────────────────────────────────────

async function deserializeMetric(m: HealthMetricRow) {
  const [hr, bps, bpd, o2, temp, wt] = await Promise.all([
    m.heart_rate ? decrypt(m.heart_rate) : null,
    m.blood_pressure_systolic ? decrypt(m.blood_pressure_systolic) : null,
    m.blood_pressure_diastolic ? decrypt(m.blood_pressure_diastolic) : null,
    m.oxygen_saturation ? decrypt(m.oxygen_saturation) : null,
    m.temperature ? decrypt(m.temperature) : null,
    m.weight ? decrypt(m.weight) : null,
  ]);

  return {
    id: m.id,
    date: m.date,
    heartRate: hr ? parseFloat(hr) : undefined,
    bloodPressureSystolic: bps ? parseFloat(bps) : undefined,
    bloodPressureDiastolic: bpd ? parseFloat(bpd) : undefined,
    oxygenSaturation: o2 ? parseFloat(o2) : undefined,
    temperature: temp ? parseFloat(temp) : undefined,
    weight: wt ? parseFloat(wt) : undefined,
  };
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function getMyMetrics(currentUser: UserRow) {
  const rows = await db<HealthMetricRow>('health_metrics')
    .where({ user_id: currentUser.id })
    .orderBy('date', 'asc');
  return Promise.all(rows.map(deserializeMetric));
}

// ── Upsert (create or update by date) ────────────────────────────────────────

export async function upsertMetric(
  currentUser: UserRow,
  data: {
    date: string;
    heartRate?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    oxygenSaturation?: number;
    temperature?: number;
    weight?: number;
  }
) {
  const encryptOptional = async (v: number | undefined) =>
    v !== undefined ? encrypt(String(v)) : undefined;

  const [hr, bps, bpd, o2, temp, wt] = await Promise.all([
    encryptOptional(data.heartRate),
    encryptOptional(data.bloodPressureSystolic),
    encryptOptional(data.bloodPressureDiastolic),
    encryptOptional(data.oxygenSaturation),
    encryptOptional(data.temperature),
    encryptOptional(data.weight),
  ]);

  const existing = await db<HealthMetricRow>('health_metrics')
    .where({ user_id: currentUser.id, date: data.date })
    .first();

  if (existing) {
    const update: Record<string, string> = {};
    if (hr !== undefined) update.heart_rate = hr;
    if (bps !== undefined) update.blood_pressure_systolic = bps;
    if (bpd !== undefined) update.blood_pressure_diastolic = bpd;
    if (o2 !== undefined) update.oxygen_saturation = o2;
    if (temp !== undefined) update.temperature = temp;
    if (wt !== undefined) update.weight = wt;

    const [updated] = await db<HealthMetricRow>('health_metrics')
      .where({ id: existing.id })
      .update(update)
      .returning('*');
    return deserializeMetric(updated);
  }

  const insert: Record<string, string | undefined> = {
    user_id: currentUser.id,
    date: data.date,
  };
  if (hr !== undefined) insert.heart_rate = hr;
  if (bps !== undefined) insert.blood_pressure_systolic = bps;
  if (bpd !== undefined) insert.blood_pressure_diastolic = bpd;
  if (o2 !== undefined) insert.oxygen_saturation = o2;
  if (temp !== undefined) insert.temperature = temp;
  if (wt !== undefined) insert.weight = wt;

  const [created] = await db<HealthMetricRow>('health_metrics')
    .insert(insert as Record<string, string>)
    .returning('*');
  return deserializeMetric(created);
}
