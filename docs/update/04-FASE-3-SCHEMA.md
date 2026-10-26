# Fase 3 — Unificación del schema Drizzle

**Estado: ✅ Completada** · Verificación: build + tests + runtime HTTP + `drizzle-kit generate` sin cambios.

## Problema

Dos copias completas del schema (59 tablas cada una) que **ya habían divergido**:

- `packages/database/src/schema.ts` → fuente de las migraciones (`drizzle.config.ts`).
- `apps/backend/src/schema.ts` → la que usaba el runtime.

Diferencias detectadas por número de línea: `inventoryMoves` 243 vs 245, `accountingEntries` 694 vs 696.

## Estrategia elegida (y por qué)

Se evaluaron tres opciones:

| Opción                                                     | Resultado                                                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A. `export * from 'database/schema'` (subpath)             | ❌ `moduleResolution: node` (node10) no resuelve el campo `exports`: el compilador veía el módulo sin miembros |
| B. Compilar `database` con declaraciones y consumir `dist` | ❌ `TS2883`: los tipos inferidos de `*Relations` de drizzle no son "portables" al emitir `.d.ts`               |
| **C. Runtime por `dist` + tipos por fuente (elegida)**     | ✅ `main: dist/index.js` (Node lo requiere) y `types: src/index.ts` (tsc compila contra la fuente)             |

## Cambios

- [x] `packages/database/package.json`: `main: dist/index.js`, `types: src/index.ts`, nuevo script `build`
      (`tsc -p tsconfig.build.json`) + script `typecheck`.
- [x] `packages/database/tsconfig.build.json`: `declaration: false`, excluye `src/scripts` y `src/test`.
- [x] `apps/backend/package.json`: nueva dependencia `database: workspace:*`.
- [x] `apps/backend/src/schema.ts`: reducido de **47,8 KB a 256 bytes** (`export * from 'database'`).
- [x] `apps/backend/src/database.ts`: reexporta `db` y `closeDatabase` del paquete → **un solo pool** de conexiones.
- [x] `turbo.json`: `build` de backend ya dependía de `^build`, así que `database` se compila antes.
- [x] `scripts/dev-entrypoint.sh`: nuevo flag `BUILD_DATABASE=true` que compila el paquete antes de arrancar
      (necesario dentro de Docker, donde `dist` no está montado).

## Verificación (evidencia real)

| #   | Prueba                                       | Resultado                                          |
| --- | -------------------------------------------- | -------------------------------------------------- |
| V-1 | `pnpm --filter database build`               | ✅ emite solo `index.js` y `schema.js` (sin tests) |
| V-2 | `pnpm --filter backend build`                | ✅ sin errores                                     |
| V-3 | `node dist/main.js` + `GET /health`          | ✅ `200 {"status":"ok","database":"up"}`           |
| V-4 | Login + `GET /v1/billing/invoices` con token | ✅ `200`                                           |
| V-5 | `pnpm --filter database db:generate`         | ✅ `No schema changes, nothing to migrate`         |
| V-6 | `turbo run test`                             | ✅ 4/4 (backend 693, database 29, frontend 75)     |
| V-7 | Contenedor `mono-backend`                    | ✅ `healthy` (compiló `database` en el entrypoint) |

> Importante: al cambiar `packages/database`, en Docker hay que reiniciar `backend`
> (`docker compose restart backend`) para que el entrypoint recompile `dist`.

## Riesgos residuales

- Los cambios de schema en caliente no se propagan sin reiniciar el backend en Docker (`P-03`).
- `packages/database` compila sin declaraciones; si en el futuro se publica el paquete,
  hay que resolver `TS2883` (`P-04`).
