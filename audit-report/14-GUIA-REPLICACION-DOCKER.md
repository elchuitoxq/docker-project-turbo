# GUÍA DE REPLICACIÓN EN DOCKER-PROYECTO-TURBO

## 1. Arquitectura Destino

```
docker-proyecto-turbo/
├── apps/
│   ├── api/          # NestJS Backend
│   └── web/         # Next.js Frontend
├── packages/
│   ├── db/          # Drizzle Schema + Migraciones
│   ├── config/       # ESLint + TS Configs
│   └── shared/      # (Opcional) Código compartido
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## 2. docker-compose.yml Recomendado

```yaml
version: '3.8'

services:
  # Base de datos
  postgres:
    image: postgres:16-alpine
    container_name: erp_postgres
    environment:
      POSTGRES_DB: erp_db
      POSTGRES_USER: erp_user
      POSTGRES_PASSWORD: erp_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U erp_user -d erp_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: erp_api
    environment:
      DATABASE_URL: postgres://erp_user:erp_pass@postgres:5432/erp_db
      PORT: 4000
      JWT_SECRET: ${JWT_SECRET:-your-secret-key-change-in-production}
      NODE_ENV: development
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./apps/api:/app
      - /app/node_modules
    command: npm run start:dev

  # Frontend Web
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: erp_web
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
      NODE_ENV: development
    ports:
      - "3005:3000"
    depends_on:
      - api
    volumes:
      - ./apps/web:/app
      - /app/node_modules
      - /app/.next
    command: npm run dev

volumes:
  postgres_data:
```

---

## 3. Dockerfiles

### apps/api/Dockerfile

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy workspace files
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package-lock.json* ./
COPY packages/db/package.json packages/db/package-lock.json* ./
COPY packages/config/package.json packages/config/package-lock.json* ./

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client (if using Prisma) or check Drizzle
RUN npm run build -w @repo/db
RUN npm run build -w apps/api

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/dist ./packages/db/dist

USER nestjs

EXPOSE 4000

CMD ["node", "dist/main"]
```

### apps/web/Dockerfile

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package-lock.json* ./
COPY packages/db/package.json packages/db/package-lock.json* ./

RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build -w @repo/db
RUN npm run build -w apps/web

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/dist ./packages/db/dist

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

---

## 4. Estructura de Archivos a Crear

### 4.1 package.json Raíz

```json
{
  "name": "docker-proyecto-turbo",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "check-types": "turbo run check-types",
    "db:generate": "turbo run db:generate",
    "db:migrate": "turbo run db:migrate",
    "db:push": "turbo run db:push",
    "db:studio": "turbo run db:studio",
    "db:seed": "turbo run db:seed"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.7.0"
  }
}
```

### 4.2 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "turborepo",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "check-types": { "dependsOn": ["^build"] },
    "db:generate": { "cache": false },
    "db:push": { "cache": false },
    "db:migrate": { "cache": false },
    "db:seed": { "cache": false }
  }
}
```

---

## 5. Pasos de Migración

### Paso 1: Crear Estructura Base

```bash
mkdir -p docker-proyecto-turbo
cd docker-proyecto-turbo

# Crear estructura
mkdir -p apps/api apps/web packages/db packages/config packages/eslint-config packages/typescript-config

# Inicializar git
git init
```

### Paso 2: Copiar de nest-next-project-erp

```bash
# Copiar archivos de configuración raíz
cp nest-next-project-erp/turbo.json .
cp nest-next-project-erp/package.json .
cp nest-next-project-erp/tsconfig.json .
cp nest-next-project-erp/.gitignore .

# Copiar packages
cp -r nest-next-project-erp/packages/db apps/
cp -r nest-next-project-erp/packages/eslint-config packages/
cp -r nest-next-project-erp/packages/typescript-config packages/

# Copiar apps (requiere adaptación)
cp -r nest-next-project-erp/apps/api apps/
cp -r nest-next-project-erp/apps/web apps/
```

### Paso 3: Adaptar package.json de cada paquete

```json
// apps/api/package.json - Cambiar nombre
{
  "name": "@app/api",
  "version": "1.0.0",
  // ...
}

// apps/web/package.json - Cambiar nombre
{
  "name": "@app/web", 
  "version": "1.0.0",
  // ...
}

// packages/db/package.json
{
  "name": "@app/db",
  "version": "1.0.0",
  // ...
}
```

### Paso 4: Crear Dockerfiles

Ver sección 3 de este documento.

### Paso 5: Ajustar imports

```typescript
// Cambiar
import { db } from '@repo/db';

// Por
import { db } from '@app/db';
```

---

## 6. Scripts de Base de Datos

### packages/db/package.json

```json
{
  "name": "@app/db",
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/seed.ts"
  }
}
```

### docker-compose.yml (con scripts)

```yaml
services:
  postgres:
    # ... config ...
  
  # Script runner (para migraciones)
  scripts:
    build:
      context: .
      dockerfile: Dockerfile.scripts
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://erp_user:erp_pass@postgres:5432/erp_db
    volumes:
      - ./packages/db:/app
    command: sleep 5 && npm run db:push && npm run db:seed
```

---

## 7. Variables de Entorno

### apps/api/.env

```env
DATABASE_URL=postgres://erp_user:erp_pass@postgres:5432/erp_db
PORT=4000
JWT_SECRET=change-this-in-production
```

### apps/web/.env

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 8.不走

### Opción A: Desarrollo Local con Docker

```bash
# Iniciar solo postgres
docker-compose up postgres

# Ejecutar migraciones
npm run db:push

# En terminals separadas
npm run dev
```

### Opción B: Todo en Docker

```bash
# Build y start
docker-compose up --build

# Ver logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## 9. Tips para Monorepo en Docker

### Volúmenes para Desarrollo

```yaml
# Los volumes permiten hot-reload
volumes:
  - ./apps/api:/app
  - /app/node_modules  # Anónimo, preserva node_modules
```

### Multi-stage Builds

```dockerfile
# Build rápido
FROM node:20-alpine AS builder
RUN npm ci && npm run build

# Imagen pequeña de producción
FROM node:20-alpine AS runner
COPY --from=builder /app/dist ./dist
```

### Usuarios No Root

```dockerfile
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
USER appuser
```

---

## 10. Checklist de Migración

- [ ] Crear estructura de carpetas
- [ ] Copiar turbo.json y configurar
- [ ] Copiar package.json raíz
- [ ] Copiar packages (db, eslint-config, typescript-config)
- [ ] Copiar apps (api, web)
- [ ] Actualizar nombres de packages (@repo → @app)
- [ ] Actualizar imports en código
- [ ] Crear Dockerfiles
- [ ] Crear docker-compose.yml
- [ ] Configurar .env
- [ ] Probar build
- [ ] Probar migraciones
- [ ] Probar seed data
- [ ] Probar dev server

---

## 11. Recursos

### Imágenes Base
- `node:20-alpine` - Ligero
- `postgres:16-alpine` - Ligero

### Puertos Comunes
| Servicio | Puerto |
|----------|--------|
| PostgreSQL | 5432 |
| API NestJS | 4000 |
| Next.js | 3000 (internal) / 3005 (exposed) |
| Drizzle Studio | 4983 |

### URLs en Desarrollo
- API: http://localhost:4000/api/docs
- Web: http://localhost:3005
- Drizzle Studio: http://localhost:4983
