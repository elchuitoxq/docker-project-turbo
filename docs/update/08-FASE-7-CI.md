# Fase 7 — CI/CD

**Estado: ✅ Completada (workflows creados y validados sintácticamente)** · Primera ejecución real pendiente en GitHub.

## Archivos creados

### `.github/workflows/ci.yml`

**Job `quality`** (bloqueante) en cada push a `main` y en cada PR:

1. `pnpm install --frozen-lockfile`
2. **`pnpm audit --prod --audit-level=high`** ← bloqueante: no vuelven a entrar CVEs de producción
3. `pnpm turbo run lint`
4. `pnpm turbo run typecheck`
5. `pnpm turbo run build`
6. `pnpm turbo run test:db:prepare`
7. `pnpm turbo run test`

Servicio `postgres:18.4-alpine3.23` en el puerto 5433 con healthcheck, equivalente a `docker-compose.test.yml`.
`concurrency` cancela ejecuciones previas de la misma rama.

**Job `e2e`** (informativo por ahora):

- Migra + siembra la base, levanta la API (`node apps/backend/dist/main.js`) y el frontend,
  espera `/health` y `/login`, instala Chromium y corre `playwright test`.
- Sube `playwright-report/` y `test-results/` como artefactos.
- `continue-on-error: true` **temporal**: se promueve a bloqueante cuando acumule ejecuciones verdes
  consecutivas (`P-11`).

### `.github/dependabot.yml`

Actualizaciones semanales agrupadas:

| Grupo         | Patrones                                                              |
| ------------- | --------------------------------------------------------------------- |
| `nestjs`      | `@nestjs/*`                                                           |
| `next-react`  | `next`, `react*`, `eslint-config-next`                                |
| `testing`     | `vitest`, `@vitest/*`, `@playwright/*`, `@testing-library/*`, `msw`   |
| `lint-format` | `eslint*`, `@typescript-eslint/*`, `prettier`, `husky`, `lint-staged` |
| `types`       | `@types/*`                                                            |

Además: `docker` y `github-actions` semanales. Se ignora `typescript >= 6` porque el frontend se queda
en TS 5.x por compatibilidad con `openapi-typescript`.

## Decisión: sin `--affected`

Turbo soporta `--affected`, pero depende de que el ref base exista en el clon (problemas típicos en PRs de
forks y en el primer push). El monorepo es pequeño, así que se corre **todo** para que el CI sea
determinista. Optimizar con `--affected` queda como mejora (`P-10`).

## Decisión: sin `format:check` en CI

`pnpm format:check` recorre también `README.md` y `docs/*.md`, que hoy no están normalizados
(se revirtió su formateo para no inflar el diff). El formato de TS/TSX sí está cubierto por
`prettier/prettier` dentro de ESLint. Normalizar la documentación y activar `format:check` queda en `P-12`.

## Verificación

| #   | Prueba                                                  | Resultado                   |
| --- | ------------------------------------------------------- | --------------------------- |
| V-1 | Parseo YAML de `ci.yml` y `dependabot.yml`              | ✅ válidos                  |
| V-2 | Los comandos del job `quality` se ejecutaron localmente | ✅ todos verdes (fases 1–6) |

## Pendientes

- `P-11`: promover `e2e` a bloqueante.
- `P-10`: usar `--affected` cuando el repo crezca.
- `P-12`: normalizar `docs/` y `README.md` y activar `format:check`.
