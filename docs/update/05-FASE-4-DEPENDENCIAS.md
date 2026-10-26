# Fase 4 — Dependencias y CVEs

**Estado: ✅ Completada** · Verificación: `pnpm audit --prod` → **0 vulnerabilidades**.

## 4.1 Vulnerabilidades de producción (resueltas)

Todas provenían de NestJS 10:

| Paquete                            | Instalado | CVE                               | Resolución                       |
| ---------------------------------- | --------- | --------------------------------- | -------------------------------- |
| `file-type` (vía `@nestjs/common`) | 20.4.1    | CVE-2026-31808, CVE-2026-32630    | NestJS 12 usa `file-type@22.1.1` |
| `@nestjs/core`                     | 10.4.22   | CVE-2026-35515 (parche ≥ 11.1.18) | NestJS 12.2.0                    |

### Upgrade ejecutado (NestJS 10.4.22 → 12.2.0)

| Paquete                                        | Antes         | Después                     |
| ---------------------------------------------- | ------------- | --------------------------- |
| `@nestjs/common` · `core` · `platform-express` | 10.4.22       | ^12.2.0                     |
| `@nestjs/config`                               | 3.3.0         | ^12.0.1                     |
| `@nestjs/jwt`                                  | 10.2.0        | ^12.0.3                     |
| `@nestjs/passport`                             | 10.0.3        | ^12.0.0                     |
| `@nestjs/swagger`                              | 7.4.2         | ^12.0.4                     |
| `@nestjs/cli` · `schematics`                   | 10.x          | ^12.0.10                    |
| `@nestjs/testing`                              | 10.4.22       | ^12.2.0                     |
| `reflect-metadata`                             | 0.1.14        | ^0.2.2                      |
| `@types/express`                               | 4.17.25       | ^5.0.6                      |
| `nestjs-pino` · `pino-http`                    | 4.6.1 · 9.0.0 | ^5.3.1 · ^11.0.0            |
| `unplugin-swc`                                 | 1.6.0         | **eliminado** (no se usaba) |

**Impacto técnico verificado:** NestJS 12 usa **Express 5.3**. El código no usaba rutas comodín ni
`req.query` mutable, así que el build y los 693 tests del backend pasan. `@nestjs/swagger@12` trae
`path-to-regexp@8.4.2` (elimina el aviso de dev que venía de tooling).

## 4.2 Vulnerabilidades de desarrollo (tooling)

Punto de partida: **26 avisos** → **1 aviso** (aceptado y justificado).

Resueltos automáticamente por el upgrade (venían de `@nestjs/cli@10`): `glob`, `picomatch`, `tmp`, `ajv`, `webpack`.

Overrides agregados en `package.json` raíz:

```jsonc
"esbuild@<0.25.0": "^0.25.12",
"uuid@<11.1.1": "^11.1.1"
```

Eliminado por ser dependencia muerta: **`openapi-codegen@2.2.2`** (−134 paquetes). Era el origen de
`adm-zip@0.5.18` (7 avisos), `path-to-regexp@2.4.0`, `validator@10.11.0` (3 avisos) y `uuid@8.3.2`.
Solo se usaba en el script `gen:api`, que no tenía consumidor (no existía `lib/api/generated`).

### Aviso restante (aceptado)

| Paquete           | Versión | CVE            | Motivo de aceptación                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@faker-js/faker` | 5.5.3   | CVE-2026-73231 | Dependencia **fija** de `postman-collection`, usada por `@stoplight/prism-cli` (mock server de desarrollo). Incluso la última versión de `postman-collection` (5.3.1) fija `faker@5.5.3`: no existe versión parcheada upstream. El vector (`helpers.fake` con plantillas controladas por el atacante) no aplica: Prism solo consume el `openapi.json` del propio repo. No se ejecuta en producción. |

## Verificación (evidencia real)

| #   | Comando                              | Antes         | Después                                       |
| --- | ------------------------------------ | ------------- | --------------------------------------------- |
| V-1 | `pnpm audit --prod`                  | ⛔ 3 moderate | ✅ `No known vulnerabilities found`           |
| V-2 | `pnpm audit` (total)                 | ⛔ 26 avisos  | ⚠️ 1 high (aceptado, dev-only)                |
| V-3 | `pnpm turbo run build`               | ✅            | ✅ 4/4                                        |
| V-4 | `pnpm turbo run test`                | ✅            | ✅ 4/4                                        |
| V-5 | `pnpm --filter database db:generate` | ✅            | ✅ (valida el override de `esbuild`)          |
| V-6 | Prism mock (`POST /v1/auth/login`)   | ✅            | ✅ responde `422` de validación (servidor OK) |

## Automatización añadida

- CI: `pnpm audit --prod --audit-level=high` es **bloqueante**.
- Dependabot semanal con grupos (`nestjs`, `next-react`, `testing`, `lint-format`, `types`).
- `pnpm.onlyBuiltDependencies` ya limitaba scripts de postinstall (se mantiene).
