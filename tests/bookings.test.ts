import request from 'supertest';
import app from '../src/app';
import db from '../src/db';
import { resetDb, closeDb } from './helpers';

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await closeDb(); });

const patientPayload = {
  firstName: 'Pat',
  lastName: 'Patient',
  email: 'patient@test.com',
  password: 'SecurePass1!',
  role: 'patient',
};

async function createPatientToken(): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send(patientPayload);
  return res.body.token;
}

describe('GET /api/v1/bookings/me', () => {
  it('returns empty array initially', async () => {
    const token = await createPatientToken();
    const res = await request(app)
      .get('/api/v1/bookings/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/v1/bookings', () => {
  it('returns 400 when nurse does not exist', async () => {
    const token = await createPatientToken();
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nurseId: '00000000-0000-0000-0000-000000000000',
        serviceType: 'home_care',
        startDate: '2026-07-20',
        endDate: '2026-07-21',
        hours: 4,
        address: '1 Test Lane',
      });
    expect(res.status).toBe(400);
  });

  it('returns 422 on missing required fields', async () => {
    const token = await createPatientToken();
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ nurseId: 'not-a-uuid' });
    expect(res.status).toBe(422);
  });

  it('creates a booking and returns it', async () => {
    // Create a nurse user + nurse profile
    const nurseReg = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Sarah', lastName: 'Nurse', email: 'nurse@test.com',
      password: 'SecurePass1!', role: 'nurse',
    });
    const nurseUserId: string = nurseReg.body.user.id;

    const [profile] = await db('nurse_profiles')
      .insert({ user_id: nurseUserId, hourly_rate: 28, years_of_experience: 5 })
      .returning('*');

    const token = await createPatientToken();
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nurseId: profile.id,
        serviceType: 'home_care',
        startDate: '2026-07-20',
        endDate: '2026-07-21',
        hours: 4,
        address: '1 Test Lane, London',
      });

    expect(res.status).toBe(201);
    expect(res.body.serviceType).toBe('home_care');
    expect(res.body.status).toBe('pending');
    expect(res.body.totalAmount).toBe(112); // 28 * 4
  });
});
