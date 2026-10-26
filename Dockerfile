# syntax=docker/dockerfile:1
# Imagen de producción del monorepo (backend + frontend standalone).
# Uso:
#   docker build --target backend  -t erp-backend:latest  .
#   docker build --target frontend -t erp-frontend:latest .

# ---------- base ----------
FROM node:26-alpine3.23 AS base
RUN apk add --no-cache libc6-compat openssl
RUN npm install -g pnpm@10.0.0
WORKDIR /app

# ---------- dependencias ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM deps AS builder
COPY packages ./packages
COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend
RUN pnpm --filter @mi-monorepo/shared-types build \
 && pnpm --filter database build \
 && pnpm --filter backend build \
 && NEXT_OUTPUT=standalone pnpm --filter frontend build

# ---------- runtime: API ----------
FROM node:26-alpine3.23 AS backend
ENV NODE_ENV=production
RUN apk add --no-cache openssl \
 && addgroup -S app && adduser -S app -G app

WORKDIR /app
# node_modules y packages comparten la misma ruta que en el builder, así que los
# symlinks de pnpm siguen siendo válidos.
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./package.json
COPY --from=builder --chown=app:app /app/packages ./packages
COPY --from=builder --chown=app:app /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder --chown=app:app /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=app:app /app/apps/backend/docs ./apps/backend/docs

USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:4000/health || exit 1
CMD ["node", "apps/backend/dist/main.js"]

# ---------- runtime: Web ----------
FROM node:26-alpine3.23 AS frontend
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
COPY --from=builder --chown=app:app /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=app:app /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=app:app /app/apps/frontend/public ./apps/frontend/public

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/login || exit 1
CMD ["node", "apps/frontend/server.js"]
