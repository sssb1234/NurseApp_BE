FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup -S ncp && adduser -S ncp -G ncp

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./dist/db/migrations

RUN mkdir -p uploads && chown ncp:ncp uploads

USER ncp

EXPOSE 3000

CMD ["sh", "-c", "node -e \"require('./dist/db/index').default.migrate.latest()\" && node dist/server.js"]
