import request from 'supertest';
import app from '../src/app';
import { resetDb, closeDb } from './helpers';

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await closeDb(); });

const userPayload = {
  firstName: 'Health',
  lastName: 'User',
  email: 'health@test.com',
  password: 'SecurePass1!',
  role: 'patient',
};

async function getToken(): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send(userPayload);
  return res.body.token;
}

describe('GET /api/v1/health-metrics/me', () => {
  it('returns empty array initially', async () => {
    const token = await getToken();
    const res = await request(app)
      .get('/api/v1/health-metrics/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/v1/health-metrics', () => {
  it('creates a metric entry', async () => {
    const token = await getToken();
    const res = await request(app)
      .post('/api/v1/health-metrics')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2026-07-08',
        heartRate: 72,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        oxygenSaturation: 98,
        temperature: 36.6,
      });
    expect(res.status).toBe(201);
    expect(res.body.heartRate).toBe(72);
    expect(res.body.date).toBe('2026-07-08');
  });

  it('retrieves created metrics', async () => {
    const token = await getToken();
    await request(app)
      .post('/api/v1/health-metrics')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-08', heartRate: 75 });

    const res = await request(app)
      .get('/api/v1/health-metrics/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].heartRate).toBe(75);
  });

  it('returns 422 on invalid date', async () => {
    const token = await getToken();
    const res = await request(app)
      .post('/api/v1/health-metrics')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: 'not-a-date', heartRate: 72 });
    expect(res.status).toBe(422);
  });
});
