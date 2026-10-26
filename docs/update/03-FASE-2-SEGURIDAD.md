# Fase 2 — Seguridad de la aplicación

**Estado: ✅ Completada** · Verificación: HTTP real contra el backend compilado y contra el contenedor.

## Objetivo

Cerrar los huecos de autorización y los secretos débiles **sin romper** el flujo del frontend.

## Tareas ejecutadas

- [x] **T2.1 — Autorización deny-by-default** `[H-01]` - Nuevo decorador `@Public()` (`src/common/decorators/public.decorator.ts`). - `JwtAuthGuard` ahora consulta el `Reflector` y deja pasar solo rutas `@Public()`. - `AppModule` registra `APP_GUARD` en orden: `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`. - `@Public()` aplicado únicamente a `POST /v1/auth/login`, `/forgot-password`, `/reset-password` y `GET /health`.
- [x] **T2.2 — Secretos fail-fast** `[H-02]` - Nuevo `src/config/env.validation.ts` con `validate:` en `ConfigModule`. - Rechaza `DATABASE_URL`/`JWT_SECRET` vacíos y los secretos por defecto conocidos
      (`default-secret-key`, `secret`, `your-secret-key-here`, `tu_clave_secreta_super_segura`). - Exige ≥32 caracteres cuando `NODE_ENV=production`. - `auth.module.ts` y `jwt.strategy.ts` usan `ConfigService.getOrThrow('JWT_SECRET')`: se eliminó el fallback.
- [x] **T2.3 — Reset de contraseña mock neutralizado** `[H-03]` - En producción `forgotPassword`/`resetPassword` lanzan `501 Not Implemented`. - Ya **no** se registra la contraseña en claro (solo su longitud) y se usa `Logger`, no `console.log`.
- [x] **T2.4 — Hardening HTTP** `[H-04]` - `helmet()` (CSP activa en producción, desactivada en dev para no romper Swagger UI). - CORS con lista explícita desde `CORS_ORIGINS` (default `localhost:3000`), `credentials: true`. - `@nestjs/throttler`: 100 req/min global; `/v1/auth/login` 5/min; `/forgot-password` y `/reset-password` 3/min.
- [x] **T2.5 — Healthcheck real** `[H-07]` - Nuevo `GET /health` (público) que ejecuta `select 1` contra Postgres y devuelve
      `{ status, database, uptime }`; `503` si la base no responde.
- [x] **T2.6 — Logging estructurado** `[H-08]` - `LoggerModule.forRoot()` de `nestjs-pino` + `app.useLogger(app.get(Logger))`. - `autoLogging` ignora `/health` para no ensuciar los logs con los healthchecks.
- [x] **T2.7 — Prefijo consistente** `[H-06]` - `@Controller('cron')` → `@Controller('v1/cron')` (sin uso previo en el frontend).
- [x] **T2.8 — Swagger en producción** - La UI y `/docs-json` solo se montan si `NODE_ENV !== 'production'` o `ENABLE_SWAGGER=true`
      (el script `openapi:export` no depende de esto y sigue funcionando).
- [x] **T2.9 — Apagado ordenado** `app.enableShutdownHooks()` y `listen(port, '0.0.0.0')`.

## Ajustes obligados por el cambio (para no romper)

| Archivo                                      | Motivo                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `auth.service.ts`                            | Nuevo parámetro de constructor `ConfigService`; TTL del token calculado desde `JWT_EXPIRES_IN`                 |
| `auth.service.test.ts`                       | Se pasa un `ConfigService` mockeado al constructor                                                             |
| `jwt-auth.guard.test.ts`                     | El guard requiere `Reflector`; se añadió el caso `@Public()` y un `ExecutionContext` con `getHandler/getClass` |
| `.env`, `.env.example`, `docker-compose.yml` | Secreto de desarrollo de 56 caracteres (los débiles ahora se rechazan)                                         |
| `envFilePath`                                | Se agregó `../../.env` para que el modo local encuentre el `.env` del monorepo                                 |

## Verificación (evidencia real)

| #    | Prueba                                                       | Resultado                                            |
| ---- | ------------------------------------------------------------ | ---------------------------------------------------- |
| V-1  | `GET /health` sin token                                      | ✅ `200 {"status":"ok","database":"up","uptime":41}` |
| V-2  | `GET /v1/billing/invoices` sin token                         | ✅ `401` (antes `200`)                               |
| V-3  | `GET /v1/users` sin token                                    | ✅ `401`                                             |
| V-4  | `GET /v1/cron/trigger-bcv` sin token                         | ✅ `401`                                             |
| V-5  | `POST /v1/auth/login` body vacío                             | ✅ `400` (público, valida DTO)                       |
| V-6  | `GET /docs-json`                                             | ✅ `200`                                             |
| V-7  | Login real (`test-admin@test.local`)                         | ✅ `200`, `expiresIn=604800`                         |
| V-8  | `GET /v1/users` con token                                    | ✅ `200`                                             |
| V-9  | `GET /v1/billing/invoices` con token                         | ✅ `200`                                             |
| V-10 | `turbo run build` / `lint` / `test`                          | ✅ 4/4 · 4/4 · 4/4                                   |
| V-11 | Stack en Docker: `mono-backend` healthcheck                  | ✅ `healthy` en 35 s                                 |
| V-12 | `GET /v1/billing/invoices` sin token **desde el contenedor** | ✅ `401`                                             |

## Riesgos residuales

- El mock de recuperación de contraseña sigue existiendo fuera de producción (`P-01`).
- El token se guarda en `localStorage` (`H-05`, fase 6/pendiente).
- `PermissionsGuard` consulta la BD en cada request con permisos requeridos (sin caché) — correcto pero
  potencial cuello de botella (`P-02`).
