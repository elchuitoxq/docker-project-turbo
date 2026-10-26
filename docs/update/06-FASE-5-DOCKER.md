# Fase 5 — Docker y Compose

**Estado: ✅ Completada** · Verificación: `docker compose up` con `postgres`, `db-setup`, `backend` y `frontend` **healthy**.

## Cambios

### `Dockerfile.dev`

- [x] Eliminado `libpq-dev` (paquete Debian inexistente en Alpine) `[H-26]`
- [x] Eliminados `python3`, `make`, `g++` (innecesarios: `postgres` y `bcryptjs` son pure-JS)
- [x] `pnpm install --frozen-lockfile` (build reproducible) `[H-28]`
- [x] `COPY` explícito de los 5 `package.json` + `pnpm-lock.yaml` antes del install (mejor caché de capas)

### `.dockerignore`

- [x] Excluye `.env` y `.env.*` (`!.env.example`) → los secretos no pueden filtrarse al contexto `[H-27]`
- [x] Excluye artefactos (`docs`, `audit-report`, `graphify-out`, `test-results`, `.agents`, `.opencode`, `e2e`)

### `docker-compose.yml` (reescrito)

- [x] **Anclas YAML** (`x-app`, `x-app-env`): 5 servicios ya no duplican `build`, `working_dir`, `restart`
- [x] **Sin secretos hardcodeados**: `${POSTGRES_PASSWORD:-…}`, `${JWT_SECRET:-…}`, `${PGADMIN_PASSWORD:-…}`
      (Compose interpola automáticamente el `.env` de la raíz) `[H-27]`
- [x] **Servicio one-shot `db-setup`**: migraciones + seed una sola vez; el backend depende con
      `service_completed_successfully` y ya no corre `RUN_DATABASE_SETUP` en cada arranque `[H-29]`
- [x] **Healthchecks**: `postgres` (`pg_isready`), `backend` (`/health`), `frontend` (`/`)
- [x] **`depends_on` con condiciones**: el frontend espera al backend _healthy_; `mock` también `[H-30]`
- [x] **`profiles: [tools]`** para `pgadmin`, `drizzle-studio` y `mock` → no arrancan por defecto
- [x] **`restart: unless-stopped`** e **`init: true`** en los servicios de aplicación
- [x] Puertos de infraestructura en `127.0.0.1` (5432, 4010, 4983, 5050) `[H-32]`
- [x] `mock` ahora se invoca con `pnpm --filter backend mock` (antes usaba una ruta absoluta a `node_modules`) `[H-30]`
- [x] `drizzle-studio` monta `drizzle.config.ts` (el `.js` duplicado fue eliminado) `[H-17]`

### `docker-compose.test.yml`

- [x] `name: erp-venezuela-test` → deja de compartir proyecto con el compose principal
      (elimina el warning "Found orphan containers") `[H-31]`
- [x] Puerto de test en `127.0.0.1:5433`

### `scripts/dev-entrypoint.sh`

- [x] Nuevo flag `BUILD_DATABASE` (compila `packages/database` antes de arrancar — necesario tras unificar el schema)
- [x] Normalizado a **LF** (un `.sh` con CRLF rompe `sh` en Linux)

### `apps/frontend/next.config.ts` (nuevo)

- [x] `transpilePackages: ['@mi-monorepo/shared-types']` `[H-12]`
- [x] `outputFileTracingRoot` para monorepo y `output: 'standalone'` opt-in vía `NEXT_OUTPUT=standalone`
- [x] `reactStrictMode: true`

## Decisiones

| Decisión                                       | Alternativa                    | Motivo                                                                                                                                          |
| ---------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **No** renombrar el proyecto Compose principal | `name: erp-venezuela`          | Renombrar cambia el namespace de volúmenes y **perdería los datos de desarrollo** existentes                                                    |
| **No** usar `corepack`                         | `corepack prepare pnpm@10.0.0` | Node 26 puede no incluir corepack; `npm i -g pnpm@10.0.0` es determinista y ya estaba funcionando                                               |
| **No** cambiar a usuario no-root en dev        | `USER app`                     | Los bind mounts de Windows/Docker Desktop romperían escrituras en `node_modules`/`.next`. Queda pendiente para la imagen de producción (`P-05`) |
| Puerto 4000/3000 en `0.0.0.0`                  | `127.0.0.1`                    | Se acceden desde el navegador del host; el resto de servicios sí quedó en loopback                                                              |

## Verificación (evidencia real)

| #    | Prueba                                                    | Resultado                                                                        |
| ---- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| V-1  | `docker compose config --quiet` (main y test)             | ✅ ambos OK                                                                      |
| V-2  | `docker compose build backend`                            | ✅ imagen construida (120 s)                                                     |
| V-3  | `docker compose up -d postgres db-setup backend frontend` | ✅ 4 servicios arriba                                                            |
| V-4  | `mono-postgres`                                           | ✅ healthy                                                                       |
| V-5  | `mono-db-setup`                                           | ✅ `exit 0` — `migrations applied successfully` + seed (`Users: 7, Invoices: 5`) |
| V-6  | `mono-backend`                                            | ✅ healthy en 35 s (healthcheck `/health`)                                       |
| V-7  | `GET /health` desde el host                               | ✅ `200 {"status":"ok","database":"up"}`                                         |
| V-8  | `GET /v1/billing/invoices` sin token (contenedor)         | ✅ `401`                                                                         |
| V-9  | `mono-frontend`                                           | ✅ healthy en 10 s                                                               |
| V-10 | `GET /login`                                              | ✅ `200` (17 771 bytes)                                                          |

## Pendientes derivados

- `P-05`: imagen de **producción** multi-stage con usuario no-root y `output: 'standalone'`.
- `P-06`: pinear `dpage/pgadmin4` por digest (hoy `:latest`).
