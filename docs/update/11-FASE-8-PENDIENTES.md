# Fase 8 — Resolución de pendientes (P-00 … P-15)

**Estado: ✅ Completada** · Verificación integral: `audit` 0 · `format:check` ✅ · `lint` 4/4 ·
`typecheck` 6/6 · `build` 4/4 · `test:coverage` 3/3 · E2E 5/5 · imagen de producción construida.

## Tabla de resoluciones

| ID     | Tema                                 | Estado | Cómo se resolvió                                                                                                                                                                                   | Evidencia                                                                                                                     |
| ------ | ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `P-00` | `@faker-js/faker@5.5.3` vía Prism    | ✅     | Se quitó `@stoplight/prism-cli` del árbol; el mock se invoca on-demand con `pnpm dlx @stoplight/prism-cli@5.16.0`                                                                                  | `pnpm audit` → **No known vulnerabilities found** · Prism responde `422` (valida el spec)                                     |
| `P-01` | Recuperación de contraseña real      | ✅     | Tabla `password_reset_tokens` (migración `0004`), token aleatorio de 32 bytes, **hash SHA-256 en BD**, TTL 1 h, un solo uso, invalidación de tokens previos, `bcrypt.hash(10)`                     | E2E HTTP: token de 64 chars → reset `200` → login nueva clave `200` → clave vieja `401` → reuso `401`                         |
| `P-02` | `PermissionsGuard` sin caché         | ✅     | Cache TTL 30 s por usuario + `invalidate(userId?)`                                                                                                                                                 | 2 tests nuevos (reutiliza cache / invalida) · 8/8 en guards                                                                   |
| `P-03` | Cambios de schema en Docker          | ✅     | `develop.watch` en el servicio `backend`: `sync` para `apps/backend/src` y `restart` para `packages/database/{src,drizzle}`                                                                        | `docker compose config` ✅ · reinicio del contenedor recompila `database`                                                     |
| `P-04` | Declaraciones de `packages/database` | ✅     | `declaration: false` en `tsconfig.json` (los tipos se consumen desde `src`)                                                                                                                        | `database#build` ✅ sin `TS2883`                                                                                              |
| `P-05` | Imagen de producción                 | ✅     | Nuevo `Dockerfile` multi-stage (`backend` y `frontend`), usuario `app` no-root, `HEALTHCHECK`, Next `standalone` vía `NEXT_OUTPUT`                                                                 | `docker build --target backend` → `erp-backend:test` · `--target frontend` → `erp-frontend:test` con `/login` `200` y uid 100 |
| `P-06` | `pgadmin4:latest`                    | ✅     | Pineado a `dpage/pgadmin4:9.10`                                                                                                                                                                    | `docker manifest inspect` verifica el tag                                                                                     |
| `P-07` | Deuda de hooks React                 | ✅     | Refactor de 11 archivos: `useSyncExternalStore` (use-mobile), estado derivado, `useWatch`, formularios internos con `key`; reglas subidas a `error`                                                | `eslint` → **0 avisos** de las 3 reglas · 75 tests · `tsc --noEmit`                                                           |
| `P-08` | `@eslint/eslintrc` sin uso           | ✅     | Eliminado de `apps/frontend`                                                                                                                                                                       | `pnpm install` ✅                                                                                                             |
| `P-09` | Coste de `isolate: true`             | ✅     | Medido: **49,9 s** la suite completa (75 tests). Se mantiene `isolate: true`                                                                                                                       | corrida cronometrada                                                                                                          |
| `P-10` | CI sin `--affected`                  | ✅     | `fetch-depth: 0` + `git fetch` del base + `--affected` en PRs (push a `main` corre todo)                                                                                                           | YAML válido                                                                                                                   |
| `P-11` | Job E2E informativo                  | ✅     | `continue-on-error` removido (bloqueante)                                                                                                                                                          | `playwright test` → **5/5** contra el stack real                                                                              |
| `P-12` | `format:check` fuera de CI           | ✅     | `format`/`format:check` con globs negativos explícitos + normalización de `README.md`, `docs/*.md`, `docs/superpowers`, `docs/SPECIFICATIONS`                                                      | `pnpm format:check` → _All matched files use Prettier code style!_                                                            |
| `P-13` | Token en `localStorage`              | ✅     | Cookie **httpOnly** `erp_token` + `GET /v1/auth/me` + `POST /v1/auth/logout` + extractor de cookie en la estrategia JWT + `credentials: 'include'` + `proxy.ts` (Next 16) + persistencia sin token | Cookie con `HttpOnly`, `SameSite=Lax`, `Path=/` · `/me` sin cookie `401` · tras logout `401` · E2E de login en navegador ✅   |
| `P-14` | Sin umbrales de cobertura            | ✅     | `coverage.thresholds` por paquete (backend 65/50/68/66 · frontend 47/48/44/50 · database 80/65/60/78) y CI corre `test:coverage`                                                                   | `turbo run test:coverage` → 3/3                                                                                               |
| `P-15` | Swagger público en dev               | ✅     | Ya estaba condicionado: solo se monta fuera de producción o con `ENABLE_SWAGGER=true` (documentado en `.env.example`)                                                                              | Fase 2 · `GET /docs-json` → `200` en dev                                                                                      |

## Segunda pasada — `P-16` y `P-17` (correo real + página de reset)

| ID     | Tema                     | Estado | Cómo se resolvió                                                                                                                                                                                                                                                          | Evidencia                                                                                                                                                                                                                                              |
| ------ | ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `P-16` | Entrega de correo real   | ✅     | `nodemailer@10` en el backend. `PasswordResetNotifier` envía por SMTP si hay `SMTP_URL`; `MAIL_FROM` configurable; HTML + texto. En producción sin `SMTP_URL` registra error y **no** entrega ni expone el token. Transporter reutilizado (singleton). 4 tests unitarios. | Mailpit (`axllent/mailpit`): `forgot-password` `200` **sin** `mockUrl` → 1 correo recibido (`no-reply@test.local` → `test-admin@test.local`, asunto «Recuperación de contraseña — ERP») → token de 64 hex extraído del cuerpo → `reset-password` `200` |
| `P-17` | Página `/reset-password` | ✅     | `app/(auth)/reset-password/page.tsx` + `components/auth/reset-password-form.tsx`: validación de coincidencia, estados de éxito, token ausente, `401` (enlace inválido), `429` (rate limit), i18n `es-VE`/`en-US`, enlaces a login                                         | `next build` incluye `○ /reset-password` · E2E 2 tests · 7/7 en 3 corridas consecutivas contra build de producción                                                                                                                                     |

### Incidente corregido: E2E flaky en `/reset-password`

`page.getByRole('alert')` resolvía **2** elementos porque Next inyecta
`<div role="alert" id="__next-route-announcer__">` tras la hidratación (de ahí el fallo intermitente).
Corrección: filtrar por texto — `getByRole('alert').filter({ hasText: /inválido|expiró/ })`.

Además, los E2E ahora corren contra el **build de producción** (`next start`) y no contra `next dev`
(la compilación on-demand hacía que el primer request superara el timeout). En CI el paso
`Start Web` usa `pnpm --filter frontend start`.

## Notas de implementación relevantes

### P-12: `.prettierignore` no se aplicaba

Al pasarle globs explícitos (`"**/*.{ts,tsx,...}"`), Prettier **no** honra `.prettierignore`
para archivos incluidos por el patrón. Se resolvió con **globs negativos** en los scripts:

```jsonc
"format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\" \"!**/node_modules/**\" ... \"!packages/database/drizzle/**\" ..."
```

Archivos excluidos: `dist`, `.next`, `coverage`, `.turbo`, `packages/database/drizzle/**`,
`api-types.ts`, `openapi.json`, `next-env.d.ts`, `test-results`, `playwright-report`,
`audit-report`, `graphify-out`, `.agents`, `.opencode`.

### P-13: `middleware.ts` → `proxy.ts`

Next 16 deprecó la convención `middleware`. Se renombró a [`apps/frontend/proxy.ts`](../../apps/frontend/proxy.ts)
y el build dejó de emitir el warning (`ƒ Proxy (Middleware)`).

### Incidente detectado y corregido: `tsconfig.base.json` faltaba en la imagen

El contenedor `mono-backend` falló al compilar `packages/database` con decenas de errores de
`drizzle-orm` (`TS1542`, `TS2344`). Causa: `packages/database/tsconfig.json` hace
`extends: "../../tsconfig.base.json"`, pero ese archivo **no estaba en la imagen ni montado**,
así que `skipLibCheck` no se aplicaba.

Corrección: `COPY tsconfig.base.json` en `Dockerfile.dev` + volumen en `backend`, `frontend` y
`db-setup`. Es exactamente el tipo de error que la verificación por contenedor detecta y el
build local no.

## Verificación integral (BT-021)

| Comando                           | Resultado                                        |
| --------------------------------- | ------------------------------------------------ |
| `pnpm install --frozen-lockfile`  | ✅ `Already up to date`                          |
| `pnpm audit` (total, incluye dev) | ✅ **No known vulnerabilities found**            |
| `pnpm format:check`               | ✅ All matched files use Prettier code style     |
| `pnpm turbo run lint`             | ✅ 4/4                                           |
| `pnpm turbo run typecheck`        | ✅ 6/6                                           |
| `pnpm turbo run build`            | ✅ 4/4                                           |
| `pnpm turbo run test:coverage`    | ✅ 3/3 (backend 695 · frontend 75 · database 29) |
| `pnpm exec playwright test`       | ✅ 5/5                                           |
| `docker build --target backend`   | ✅ `erp-backend:test`                            |
| `docker compose ps`               | ✅ backend + frontend + postgres `healthy`       |
