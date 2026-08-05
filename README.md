# NursesCare Platform — Express.js Backend API

Node.js + Express + TypeScript backend serving the **NursesCare** nurses & carers marketplace.  
Matches the React/TypeScript frontend API calls at `http://localhost:3000/api/v1`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | **Node.js 20** |
| Framework | **Express.js 4** + TypeScript |
| ORM / Query Builder | **Knex.js** |
| Database | **PostgreSQL 12+** with `pgcrypto` column-level encryption |
| Auth | **JWT** (jsonwebtoken) + **OAuth 2.0** (Google / Microsoft) + **MFA/TOTP** (otplib) |
| Password hashing | bcryptjs (12 rounds) |
| Validation | express-validator |
| File uploads | Multer (local disk, extensible to S3) |
| Logging | Winston |
| Tests | Jest + Supertest |

---

## Project Layout

```
backend/
├── src/
│   ├── app.ts                    ← Express app factory (no port binding)
│   ├── server.ts                 ← Entry point — binds port, checks DB
│   ├── config/index.ts           ← All env config in one place
│   ├── db/
│   │   ├── index.ts              ← Knex instance
│   │   ├── knexfile.ts           ← Knex config (dev/test/prod)
│   │   ├── crypto.ts             ← pgcrypto encrypt/decrypt helpers
│   │   └── migrations/
│   │       └── 001_initial_schema.ts
│   ├── middleware/
│   │   ├── authenticate.ts       ← Bearer JWT → req.user
│   │   ├── authorize.ts          ← Role-based access
│   │   ├── validate.ts           ← express-validator errors → 422
│   │   ├── errorHandler.ts       ← Central error handler
│   │   └── upload.ts             ← Multer config
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.service.ts   ← register, login, MFA, OAuth, refresh
│   │   │   └── auth.router.ts    ← /auth/* routes
│   │   ├── nurses/
│   │   │   ├── nurses.service.ts ← search, get, update, credential upload
│   │   │   └── nurses.router.ts  ← /nurses/* routes
│   │   ├── bookings/
│   │   │   ├── bookings.service.ts
│   │   │   └── bookings.router.ts
│   │   └── health-metrics/
│   │       ├── health-metrics.service.ts
│   │       └── health-metrics.router.ts
│   ├── types/index.ts            ← DB row types + Express augmentation
│   └── utils/
│       ├── jwt.ts                ← JWT sign/verify, token hash
│       ├── password.ts           ← bcrypt helpers
│       ├── mfa.ts                ← otplib TOTP + QR code
│       └── logger.ts             ← Winston
├── tests/
│   ├── helpers.ts                ← DB reset / close utilities
│   ├── auth.test.ts
│   ├── bookings.test.ts
│   └── health-metrics.test.ts
├── scripts/
│   └── init_pgcrypto.sql
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Quick Start (Docker)

```bash
cd C:\Users\003T57744\.bob\backend
copy .env.example .env
# Edit .env — set strong JWT_SECRET, REFRESH_TOKEN_SECRET, DB_ENCRYPTION_KEY

docker compose up --build
```

API at **http://localhost:3000/api/v1**

---

## Quick Start (Local)

```bash
cd C:\Users\003T57744\.bob\backend
npm install
copy .env.example .env        # edit secrets

# PostgreSQL must be running with ncp_db created
npm run migrate               # run Knex migrations
npm run dev                   # ts-node-dev with hot reload
```

---

## API Endpoints

### Auth — `/api/v1/auth`

| Method | Path | Frontend service call |
|---|---|---|
| `POST` | `/register` | `authService.register()` |
| `POST` | `/login` | `authService.login()` |
| `GET` | `/me` | `authService.getProfile()` |
| `POST` | `/logout` | `authService.logout()` |
| `POST` | `/refresh` | `authService.refreshToken()` |
| `POST` | `/mfa/setup` | — enroll TOTP, returns QR PNG (base64) |
| `POST` | `/mfa/confirm` | — activate MFA after first code |
| `POST` | `/mfa/verify` | — complete MFA login |
| `GET` | `/oauth/google` | — returns Google auth URL |
| `GET` | `/oauth/google/callback` | — exchange code → JWT |
| `GET` | `/oauth/microsoft` | — returns Microsoft auth URL |
| `GET` | `/oauth/microsoft/callback` | — exchange code → JWT |

### Nurses — `/api/v1/nurses`

| Method | Path | Frontend service call |
|---|---|---|
| `GET` | `/` | `nurseService.searchNurses()` |
| `GET` | `/:id` | `nurseService.getNurseById()` |
| `PUT` | `/:id` | `nurseService.updateProfile()` |
| `POST` | `/:id/credentials` | `nurseService.uploadCredential()` |

### Bookings — `/api/v1/bookings`

| Method | Path | Frontend service call |
|---|---|---|
| `POST` | `/` | `bookingService.createBooking()` |
| `GET` | `/me` | `bookingService.getMyBookings()` |
| `GET` | `/:id` | `bookingService.getBookingById()` |
| `PATCH` | `/:id/cancel` | `bookingService.cancelBooking()` |
| `PATCH` | `/:id/confirm` | `bookingService.confirmBooking()` |

### Health Metrics — `/api/v1/health-metrics`

| Method | Path | Description |
|---|---|---|
| `GET` | `/me` | List all patient vitals |
| `POST` | `/` | Record / upsert vitals for a date |

---

## Security

### pgcrypto Encryption at Rest
All PII stored as `pgp_sym_encrypt(value, key)` AES-256 ciphertext:
- `users.phone`
- `health_metrics.*` (all 6 vital columns) — GDPR special-category
- `mfa_configs.totp_secret`

Encryption key: `DB_ENCRYPTION_KEY` in `.env` — **never commit to source control**.

### JWT
- **Access token** — 30-min expiry, HS256, verified on every protected request
- **Refresh token** — 7-day expiry, stored only as SHA-256 hash; rotated on each use; all revoked on logout

### MFA Flow (TOTP — RFC 6238)
1. `POST /auth/mfa/setup` → QR code PNG base64 + provisioning URI
2. User scans with authenticator app (Google Auth / Authy / MS Auth)
3. `POST /auth/mfa/confirm` with first 6-digit code — activates MFA
4. Next login: password returns `mfa_required: true` + short-lived `temp_token`
5. `POST /auth/mfa/verify` with `temp_token` + TOTP code → full JWT

### OAuth 2.0
Provider token exchange happens **server-side** — frontend never handles provider tokens. Auto-creates account on first login.

---

## Running Tests

```bash
# Ensure test DB exists: createdb ncp_db_test
npm run migrate    # migrate test DB (NODE_ENV=test picks ncp_db_test)
npm test
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions.
