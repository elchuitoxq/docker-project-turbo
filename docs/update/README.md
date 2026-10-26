# 📘 Plan de Actualización y Endurecimiento — Histórico de Procedimientos

> **Documento vivo.** Se actualiza al final de **cada** fase. Toda tarea ejecutada debe quedar
> marcada como `[x]` y toda verificación debe registrar su resultado real (comando + salida).
>
> Inicio del plan: **2026-10-26**
> Repositorio: `elchuitoxq/docker-project-turbo`
> Rama de trabajo: `main`

---

## Cómo leer esta carpeta

| Archivo                                                    | Contenido                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`00-BASELINE.md`](./00-BASELINE.md)                       | Entorno, estado inicial del repo y auditoría de dependencias **antes** de tocar nada |
| [`01-HALLAZGOS.md`](./01-HALLAZGOS.md)                     | Catálogo completo de hallazgos con ID, severidad y **estado**                        |
| [`02-FASE-1-BUGS.md`](./02-FASE-1-BUGS.md)                 | Fase 1 — Bugs que rompen hoy (config/build/lint/test)                                |
| [`03-FASE-2-SEGURIDAD.md`](./03-FASE-2-SEGURIDAD.md)       | Fase 2 — Autorización, secretos, hardening HTTP                                      |
| [`04-FASE-3-SCHEMA.md`](./04-FASE-3-SCHEMA.md)             | Fase 3 — Unificación del schema Drizzle                                              |
| [`05-FASE-4-DEPENDENCIAS.md`](./05-FASE-4-DEPENDENCIAS.md) | Fase 4 — CVEs, upgrade de NestJS, overrides                                          |
| [`06-FASE-5-DOCKER.md`](./06-FASE-5-DOCKER.md)             | Fase 5 — Dockerfile, Compose, secretos, imágenes                                     |
| [`07-FASE-6-CALIDAD.md`](./07-FASE-6-CALIDAD.md)           | Fase 6 — Turborepo, TS, lint, tests, higiene                                         |
| [`08-FASE-7-CI.md`](./08-FASE-7-CI.md)                     | Fase 7 — CI/CD y escaneo continuo                                                    |
| [`09-BITACORA.md`](./09-BITACORA.md)                       | Cronología de comandos ejecutados y resultados                                       |
| [`10-PENDIENTES.md`](./10-PENDIENTES.md)                   | Backlog y riesgos aceptados con justificación                                        |
| [`11-FASE-8-PENDIENTES.md`](./11-FASE-8-PENDIENTES.md)     | Fase 8 — Resolución de `P-00` … `P-15` con evidencia                                 |

**Leyenda de estado:** `⬜ Pendiente` · `🟨 En progreso` · `✅ Completado` · `⛔ Bloqueado` · `🗄️ Aceptado (riesgo documentado)`

---

## Estado global de fases

| Fase | Alcance                     | Estado        | Verificación final                                                                                     |
| ---- | --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| 0    | Baseline y red de seguridad | ✅ Completada | `install --frozen-lockfile` + baseline de audit/build/lint/test registrado                             |
| 1    | Bugs que rompen hoy         | ✅ Completada | build 3/3 · lint 5/5 · test 4/4                                                                        |
| 4    | Dependencias / CVEs         | ✅ Completada | `pnpm audit --prod` → **0 vulnerabilidades** · build 4/4 · test 4/4                                    |
| 2    | Seguridad de la aplicación  | ✅ Completada | HTTP real: `401` sin token, `200` con token, `200` en `/health`                                        |
| 3    | Unificación del schema      | ✅ Completada | `db:generate` sin cambios · runtime `200` · test 4/4                                                   |
| 5    | Docker / Compose            | ✅ Completada | 4 servicios `healthy` · `db-setup` `exit 0` · `/login` `200`                                           |
| 6    | Calidad y configuración     | ✅ Completada | typecheck 6/6 · lint 4/4 · test 4/4 · 5 corridas estables                                              |
| 7    | CI/CD                       | ✅ Completada | YAML validado · comandos del job ejecutados localmente                                                 |
| 8    | Resolución de pendientes    | ✅ Completada | audit 0 · format ✅ · lint 4/4 · typecheck 6/6 · build 4/4 · coverage 3/3 · E2E 5/5 · imágenes prod ✅ |
| 9    | Correo real + página reset  | ✅ Completada | Mailpit: correo entregado y `reset` 200 · `/reset-password` en el build · E2E **7/7** × 3 corridas     |

### Verificación integral de cierre (BT-026)

```
pnpm install --frozen-lockfile   → Already up to date
pnpm audit                       → No known vulnerabilities found   (prod Y dev)
pnpm format:check                → All matched files use Prettier code style
pnpm turbo run lint              → 4/4
pnpm turbo run typecheck         → 6/6
pnpm turbo run build             → 4/4
pnpm turbo run test:coverage     → 4/4  (699 + 75 + 29 tests, umbrales OK)
pnpm exec playwright test        → 7/7   (× 3 corridas, build de producción)
docker build --target backend    → erp-backend:test
docker build --target frontend   → erp-frontend:test (uid 100, /login 200)
```

> **Nota sobre el orden:** el plan original numeraba 0→7. La ejecución real adelantó la
> **Fase 4 (dependencias)** antes de la **Fase 2 (seguridad)** porque el hardening requiere
> `@nestjs/throttler` y `helmet`, y no tenía sentido instalar paquetes dos veces (una para
> Nest 10 y otra para Nest 12). El resto del orden se mantuvo.

### Resumen

- **10 fases completadas**, **42 hallazgos** catalogados: **38 resueltos**, **2 parciales**,
  **2 aceptados**. **19 pendientes** (`P-00` … `P-17`) resueltos.
- **Vulnerabilidades: 26 → 0** (producción _y_ desarrollo).
- **Build/lint/test pasaron de roto a verde** y quedaron bloqueando en CI (incluido E2E).
- **Sesión migrada a cookie httpOnly** (el JWT ya no se guarda en `localStorage`).
- **Recuperación de contraseña real**: token hasheado de un solo uso, TTL 1 h, **correo por SMTP**
  (verificado con Mailpit) y **página `/reset-password`**.
- **Pendientes abiertos**: solo mejora incremental (`P-18` a `P-27`) — ver [`10-PENDIENTES.md`](./10-PENDIENTES.md).

---

## Regla de oro del procedimiento

1. **Nunca** se avanza de fase sin que la verificación de la fase anterior pase.
2. Cada fase termina con: `pnpm install --frozen-lockfile` + `turbo run lint typecheck build test`.
3. Todo cambio de dependencias se valida con `pnpm audit` antes/después.
4. Todo cambio de comportamiento del backend se valida con una prueba HTTP real (sin token → `401`).
5. Si una verificación falla, se documenta en [`09-BITACORA.md`](./09-BITACORA.md) y el ítem vuelve a `⬜`/`🟨`.
