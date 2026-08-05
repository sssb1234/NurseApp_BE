import request from 'supertest';
import app from '../src/app';
import { resetDb, closeDb } from './helpers';

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await closeDb(); });

const registerPayload = {
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@test.com',
  password: 'SecurePass1!',
  role: 'patient',
};

describe('POST /api/v1/auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@test.com');
    expect(res.body.token).toBeDefined();
    expect(res.body.mfa_required).toBe(false);
  });

  it('returns 409 on duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload);
    expect(res.status).toBe(409);
  });

  it('returns 422 on invalid payload', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'bad' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);
  });

  it('returns access token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: registerPayload.email, password: registerPayload.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: registerPayload.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns user profile with valid token', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload);
    const token: string = reg.body.token;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@test.com');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns a new access token', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload);
    const refresh: string = reg.body.refresh_token;

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refresh });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 on invalid token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'invalid-token' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes refresh tokens and returns 204', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload);
    const token: string = reg.body.token;
    const refresh: string = reg.body.refresh_token;

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    // Refresh token should now be revoked
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refresh });
    expect(refreshRes.status).toBe(401);
  });
});
