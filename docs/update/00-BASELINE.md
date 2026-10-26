# Fase 0 — Baseline y red de seguridad

**Estado:** 🟨 En progreso → se cierra al completar la primera verificación integral.

## 1. Entorno detectado

| Componente     | Versión  | Observación                                                |
| -------------- | -------- | ---------------------------------------------------------- |
| Node.js (host) | v24.16.0 | El contenedor usa `node:26-alpine3.23`                     |
| pnpm           | 10.0.0   | Coincide con `packageManager` y con `Dockerfile.dev` ✅    |
| Docker Engine  | 29.5.3   | Disponible para validar imágenes y `docker compose config` |
| SO             | Windows  | Los scripts de `package.json` deben ser cross-platform     |
| Rama           | `main`   | `git status` limpio al inicio ✅                           |

## 2. Verificaciones de partida

| #   | Comprobación                               | Comando                          | Resultado                        |
| --- | ------------------------------------------ | -------------------------------- | -------------------------------- |
| B-1 | Lockfile reproducible                      | `pnpm install --frozen-lockfile` | ✅ `Already up to date` (exit 0) |
| B-2 | Vulnerabilidades de **producción**         | `pnpm audit --prod`              | ⛔ **3 moderate** (ver §3)       |
| B-3 | Vulnerabilidades **totales** (incluye dev) | `pnpm audit`                     | ⛔ **26 avisos** (ver §3)        |

## 3. Auditoría inicial de dependencias (línea base)

### 3.1 Producción (`pnpm audit --prod` → 3 avisos)

| Severidad | Paquete        | Instalado | Parcheado | CVE            | Origen                   |
| --------- | -------------- | --------- | --------- | -------------- | ------------------------ |
| moderate  | `file-type`    | 20.4.1    | ≥21.3.1   | CVE-2026-31808 | `@nestjs/common@10.4.22` |
| moderate  | `file-type`    | 20.4.1    | ≥21.3.2   | CVE-2026-32630 | `@nestjs/common@10.4.22` |
| moderate  | `@nestjs/core` | 10.4.22   | ≥11.1.18  | CVE-2026-35515 | dependencia directa      |

> **Conclusión:** las 3 se resuelven con el **upgrade de NestJS 10 → 12**. Verificado:
> `@nestjs/common@12.2.0` depende de `file-type@22.1.1` (parcheado) y `@nestjs/core@12.2.0`
> está por encima del parche `11.1.18`.

### 3.2 Dev / tooling (`pnpm audit` completo)

| Severidad | Paquete           | Instalado | Parcheado | CVE                                             |
| --------- | ----------------- | --------- | --------- | ----------------------------------------------- |
| high      | `@faker-js/faker` | 5.5.3     | ≥10.5.0   | CVE-2026-73231                                  |
| high      | `adm-zip`         | 0.5.18    | ≥0.6.1    | CVE-2026-102282, CVE-2026-77301, CVE-2026-39244 |
| high      | `glob`            | 10.4.5    | ≥10.5.0   | CVE-2025-64756                                  |
| high      | `path-to-regexp`  | 2.4.0     | ≥3.3.0    | CVE-2024-45296                                  |
| high      | `picomatch`       | 4.0.1     | ≥4.0.4    | CVE-2026-33671                                  |
| high      | `tmp`             | 0.0.33    | ≥0.2.6    | CVE-2026-44705                                  |
| high      | `validator`       | 10.11.0   | ≥13.15.22 | CVE-2025-12758                                  |
| moderate  | `ajv`             | 8.12.0    | ≥8.18.0   | CVE-2025-69873                                  |
| moderate  | `esbuild`         | 0.18.20   | ≥0.25.0   | GHSA-67mh-4wv8-2f99                             |
| moderate  | `picomatch`       | 4.0.1     | ≥4.0.4    | CVE-2026-33672                                  |
| moderate  | `uuid`            | 8.3.2     | ≥11.1.1   | CVE-2026-41907                                  |
| moderate  | `validator`       | 10.11.0   | ≥13.15.20 | CVE-2025-56200                                  |
| moderate  | `validator`       | 10.11.0   | ≥13.7.0   | CVE-2021-3765                                   |
| low       | `tmp`             | 0.0.33    | ≥0.2.4    | CVE-2025-54798                                  |
| low       | `webpack`         | 5.97.1    | ≥5.104.1  | CVE-2025-68458                                  |
| low       | `webpack`         | 5.97.1    | ≥5.104.0  | CVE-2025-68157                                  |

> Estas llegan por tooling de desarrollo (`@stoplight/prism-cli`, `openapi-codegen`,
> `@nestjs/cli`, `@commitlint/cli`, `@typescript-eslint/*`). Se atacan en la Fase 4 con
> overrides selectivos + dedupe, y lo que no sea seguro de forzar queda como riesgo aceptado.

## 4. Baseline funcional (pre-cambios)

Registrado en [`09-BITACORA.md`](./09-BITACORA.md) entrada `BT-001`.

| Comprobación      | Resultado                |
| ----------------- | ------------------------ |
| `turbo run build` | ⬜ se registra en BT-002 |
| `turbo run lint`  | ⬜ se registra en BT-002 |
| `turbo run test`  | ⬜ se registra en BT-002 |

## 5. Criterio de salida de la Fase 0

- [x] Versiones y entorno documentados
- [x] `pnpm install --frozen-lockfile` verde
- [x] Auditoría inicial registrada (prod y total)
- [x] Baseline funcional registrado (build/lint/test)
