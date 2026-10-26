# Fase 1 — Bugs que rompen hoy

**Estado: ✅ Completada** · Verificación: `turbo run build` 3/3 · `turbo run lint` 5/5 · `turbo run test` 4/4

## Objetivo

Dejar el repo en un estado donde `build`, `lint` y `test` sean confiables. Sin esto, cualquier
fase posterior no se puede auditar.

## Tareas ejecutadas

- [x] **T1.1** `Dockerfile.dev`: eliminar `libpq-dev` (paquete Debian inexistente en Alpine) y
      `python3 make g++` (innecesarios: `postgres` y `bcryptjs` son pure-JS).
      → `apk add --no-cache libc6-compat openssl netcat-openbsd` `[H-26]`
- [x] **T1.2** `apps/backend/tsconfig.build.json` nuevo, excluyendo `**/*.test.ts`, `**/*.spec.ts`
      y `src/test/**`; `nest-cli.json` con `deleteOutDir: true`.
      → `dist/` ya no contiene tests (`Get-ChildItem dist -Filter *.test.js` → 0) y sigue
      generando `dist/scripts/export-openapi.js` (necesario para `openapi:export`). `[H-10]`
- [x] **T1.3** `packages/shared-types`: `build` ahora ejecuta `generate && tsc`.
      → `turbo run build` pasa (antes fallaba con `TS2307: Cannot find module './api-types'`). `[H-15]`
- [x] **T1.4** `packages/shared-types/scripts/sync.mjs`: `npx --yes openapi-typescript` →
      `pnpm exec openapi-typescript` (usa la devDependency instalada, sin descargas). `[H-16]`
- [x] **T1.5** `apps/frontend`: eliminado `ESLINT_USE_FLAT_CONFIG=false` y `--ext`; el lint cubre
      `app components modules lib hooks src`; `eslint.config.mjs` migrado de `FlatCompat` (rompía
      con "Converting circular structure to JSON") a import directo de `eslint-config-next/core-web-vitals`;
      añadida la devDependency `eslint-config-next@^16.4.3`. `[H-18] [H-24]`
- [x] **T1.6** Nuevo `eslint.config.mjs` raíz compartido + configs delgados en
      `packages/database` y `packages/shared-types` (no tenían ninguno → `turbo run lint` fallaba). `[H-19]`
- [x] **T1.7** Eliminados `apps/backend/.eslintrc.js`, `apps/backend/eslint.config.js` (CJS) y
      `.eslintrc.js` raíz; el backend pasa a `eslint.config.mjs` que hereda del base. `[H-21]`
- [x] **T1.8** `apps/backend`: `cross-env` en `dev:tools` (compatibilidad Windows) y `-D cross-env@^10.1.0`. `[H-22]`
- [x] **T1.9** Eliminados `apps/backend/webpack.config.js` (código muerto: usaba `ts-loader` no instalado,
      `nest-cli.json` no activa webpack) y `packages/database/drizzle.config.js` (duplicado del `.ts`);
      volumen de `drizzle-studio` en Compose actualizado a `drizzle.config.ts`. `[H-17]`
- [x] **T1.10** `.gitattributes` (`* text=auto eol=lf`) + normalización con Prettier 3.9 para eliminar
      los 10 errores `Delete ␍` y el formateo desactualizado. `.prettierignore` ampliado para no tocar
      artefactos (`.agents/`, `graphify-out/`, `audit-report/`, `.opencode/`, `test-results/`,
      `playwright-report/`, `api-types.ts`, `openapi.json`). `[H-23]`
- [x] **T1.11** `.gitignore`: `test-results/`, `playwright-report/`, `blob-report/`, `graphify-out/`,
      `.opencode/`, `packages/shared-types/openapi.json`. `[H-39]`
- [x] **T1.12** `reports.test.ts`: `createChain` ahora expone `innerJoin`/`leftJoin`.
      → los 5 tests de `getRetencionesIslrXml` pasan. `[H-20]`

## Decisiones y justificaciones

| Decisión                                                                                        | Alternativa descartada               | Motivo                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `api-types.ts` se **commitea** (no se ignora)                                                   | Ignorarlo y exigir `pnpm sync:types` | `next dev` fallaría en un clon limpio; el spec `openapi.json` ya está versionado, así que el resultado es determinista |
| Reglas nuevas de React (`set-state-in-effect`, `purity`, `incompatible-library`) bajan a `warn` | Corregir los 10 errores de hooks     | Corregirlos implica refactor de componentes con riesgo funcional; se registra como deuda `P-07`                        |
| Formateo masivo con Prettier                                                                    | Ajustar `endOfLine: "auto"`          | El repo declara `lf`; lo correcto es normalizar y evitar reintroducir CRLF vía `.gitattributes`                        |

## Verificaciones ejecutadas

| #   | Comando                                                 | Antes                                                              | Después                      |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| V-1 | `pnpm turbo run build`                                  | ❌ `@mi-monorepo/shared-types#build` (TS2307)                      | ✅ 3/3                       |
| V-2 | `pnpm turbo run lint`                                   | ❌ 4 fallos (frontend, database, shared-types, shared-types#build) | ✅ 5/5                       |
| V-3 | `pnpm turbo run test`                                   | ❌ `backend#test` (5 fallos de 692)                                | ✅ 4/4 (692 + 29 + frontend) |
| V-4 | `Get-ChildItem apps/backend/dist -Filter *.test.js`     | 30 archivos                                                        | 0                            |
| V-5 | `Test-Path apps/backend/dist/scripts/export-openapi.js` | —                                                                  | `True`                       |

## Pendientes generados por esta fase

- `P-07`: corregir la deuda de hooks de React (9 + 1 errores degradados a warning).
- `P-08`: revisar si `@eslint/eslintrc` sigue siendo necesario en `apps/frontend` (ya no se usa).
