# CI/CD con Caché Local — Diseño

**Fecha:** 2026-06-02
**Estado:** Aprobado
**Autor:** Equipo de desarrollo
**Tipo:** Sub-proyecto aislado (infra/calidad)

---

## 1. Contexto

El monorepo `docker-project-turbo` (ERP Venezuela) cuenta con backend (NestJS 10) y database (Drizzle ORM) completos, con frontend (Next.js 16) pendiente. Hoy no existe ningún pipeline de CI/CD: no hay `.github/workflows/`, no hay `.github/` siquiera, y los 42 tests unitarios + 7 integration tests solo se ejecutan manualmente en el host o dentro de Docker.

Esto significa que:

- No hay gate automático antes de merge (cualquier push puede romper el build).
- No hay evidencia reproducible de que `main` esté verde.
- El refactor futuro (FASE 3 Frontend, módulos pendientes del backend, mejoras de arquitectura marcadas como 🔴 ALTA en `audit-report/13-MEJORAS-ARQUITECTURA.md`) llegará a `main` sin verificación previa.

**Decisión de scope:** este sub-proyecto se enfoca únicamente en CI/CD. No deploy, no e2e con Playwright, no coverage gates, no security scanning. Esos vendrán después como sub-proyectos aislados propios.

**Decisión de cache:** el proyecto no mantiene dependencias con Vercel. Se usa **caché local** vía `actions/cache`, sin secrets externos, sin cuentas de terceros.

---

## 2. Objetivos y No-objetivos

### Objetivos (in-scope)

1. Pipeline de CI en GitHub Actions que corra en cada PR y en cada push a `main`.
2. Caché local de `pnpm store` y de `.turbo/` para minimizar tiempo de ejecución.
3. Jobs paralelos de lint, typecheck, format check.
4. Jobs de test (unit + integration con Postgres como service container).
5. Job de build con upload de artefactos.
6. Composite action reutilizable para setup (pnpm + node + cache).
7. Matrix Node 20 + 22 (las dos LTS activas hoy).
8. Workflow de smoke diario que verifique que el setup sigue vivo.
9. Branch protection rules documentados.
10. Documentación en `docs/CI.md` para troubleshooting y para añadir nuevos jobs.

### No-objetivos (out-of-scope, explícito)

- ❌ Deploy automático a Vercel o cualquier provider.
- ❌ E2E con Playwright (requiere browsers, agregar después como sub-proyecto aparte).
- ❌ Coverage gates con umbral mínimo (estabilizar primero).
- ❌ Security scanning (CodeQL, Snyk, Dependabot de dependencias — solo del workflow).
- ❌ Release automation / changesets.
- ❌ Docker publish (build & push de imágenes).
- ❌ Self-hosted runners.
- ❌ Migración a `eslint.config.js` flat config (ortogonal al CI).
- ❌ Remote cache (Vercel, self-hosted, S3). Esta es una decisión consciente: si en el futuro se quiere añadir, es un PR de ~5 líneas sobre esta base (solo secrets + env en jobs).

---

## 3. Arquitectura

### 3.1 Estructura de archivos

```
.github/
├── actions/
│   └── setup/
│       └── action.yml              # composite action: pnpm + node + cache
├── workflows/
│   ├── ci.yml                       # pipeline principal (PR + push main)
│   └── ci-smoke.yml                 # cron diario, valida setup
└── dependabot.yml                   # updates de actions
docs/
├── CI.md                            # troubleshooting + cómo añadir jobs
└── superpowers/specs/
    └── 2026-06-02-cicd-local-cache-design.md   # este documento
```

### 3.2 Triggers

| Workflow       | Trigger                             | Justificación                               |
| -------------- | ----------------------------------- | ------------------------------------------- |
| `ci.yml`       | `pull_request` (cualquier rama)     | Gate por PR                                 |
| `ci.yml`       | `push` a `main`                     | Verificar que `main` sigue verde            |
| `ci.yml`       | `workflow_dispatch`                 | Re-run manual con inputs custom             |
| `ci-smoke.yml` | `schedule` (cron diario, 06:00 UTC) | Detectar drift antes de que un dev lo sufra |
| `ci-smoke.yml` | `workflow_dispatch`                 | Re-run manual                               |

### 3.3 Concurrencia

Ambos workflows definen:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

En PRs, un push nuevo cancela el run anterior. En `main` y en el cron, los runs no se cancelan (queremos que terminen).

### 3.4 Permisos

Default para todos los workflows:

```yaml
permissions:
  contents: read
```

Los jobs individuales no suben permisos salvo donde estrictamente necesario (status checks, si se añaden en el futuro). Reducir blast radius si un token se filtra.

---

## 4. Pipeline `ci.yml` (núcleo)

### 4.1 Estructura general

Tres stages secuenciales con jobs paralelos dentro de cada uno (cuando es posible).

```
Stage 1: Setup (compartido, corre una vez)
   ├── setup-and-cache (composite action)
   └── pnpm install + cache hit/miss check

Stage 2: Quality (paralelo, sin dependencias entre sí)
   ├── lint
   ├── typecheck
   └── format:check

Stage 3: Test (paralelo, con service container postgres)
   ├── unit
   └── integration

Stage 4: Build
   └── build (necesita lint + typecheck + test en verde)
```

### 4.2 Stage 1: Setup

Usa composite action `.github/actions/setup/action.yml` que:

1. Configura Node (`node-version: ${{ inputs.node-version || '20' }}`).
2. Habilita pnpm via Corepack.
3. Restaura/guarda caché de pnpm store con clave basada en hash de `pnpm-lock.yaml`.
4. Restaura/guarda caché de `.turbo/` con clave basada en hash de `pnpm-lock.yaml` + `turbo.json` + `**/package.json`.
5. Reporta hit/miss en logs.

Si Corepack no está disponible (versiones viejas de Node), fallback a `pnpm/action-setup@v4`.

### 4.3 Stage 2: Quality

Tres jobs independientes que se ejecutan en paralelo tras `setup`:

| Job            | Comando                               | Falla si                          |
| -------------- | ------------------------------------- | --------------------------------- |
| `lint`         | `pnpm turbo run lint --affected`      | Cualquier error de ESLint         |
| `typecheck`    | `pnpm turbo run typecheck --affected` | Cualquier error de `tsc --noEmit` |
| `format:check` | `pnpm format:check`                   | Cualquier archivo mal formateado  |

Nota: el comando `typecheck` se modela como un nuevo task en `turbo.json` (ver §4.7). Hoy no existe; se añade en este sub-proyecto.

### 4.4 Stage 3: Test

Dos jobs paralelos:

#### `unit`

```yaml
- run: pnpm turbo run test --affected
```

Sin service container, sin DB. Corre los unit tests existentes (auth, billing, treasury, payroll).

#### `integration`

Levanta Postgres como service container, espera el health check, genera migraciones, ejecuta integration tests:

```yaml
services:
  postgres:
    image: postgres:18.4-alpine3.23
    env:
      POSTGRES_USER: ci_user
      POSTGRES_PASSWORD: ci_pass
      POSTGRES_DB: ci_db
    ports: ['5432:5432']
    options: >-
      --health-cmd "pg_isready -U ci_user"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

Pasos del job:

1. Set `DATABASE_URL=postgresql://ci_user:ci_pass@localhost:5432/ci_db`.
2. `pnpm --filter database db:generate`.
3. `pnpm --filter database db:migrate`.
4. `pnpm --filter database db:seed:rbac`.
5. `pnpm --filter backend test -- --run src/test/integration.test.ts`.
6. Upload `coverage/` como artefacto (7 días).

### 4.5 Stage 4: Build

```yaml
needs: [lint, typecheck, unit, integration]
runs-on: ubuntu-latest
steps:
  - uses: actions/checkout@v4
  - uses: ./.github/actions/setup
  - run: pnpm turbo run build --affected
  - uses: actions/upload-artifact@v4
    with:
      name: build-output
      path: |
        apps/backend/dist
        apps/frontend/.next
      retention-days: 7
```

Solo corre si los 4 jobs anteriores pasaron.

### 4.6 Service container: Postgres

Imagen pinneada: `postgres:18.4-alpine3.23` (alineada con `docker-compose.yml` y `README.md`).

Credenciales hardcodeadas en el workflow (no son secretos: solo se usan en el entorno efímero del job). El job exporta `DATABASE_URL` apuntando a `localhost:5432` (el service se mapea al host del runner).

### 4.7 Cambios requeridos en `turbo.json`

Hoy `turbo.json` tiene: `build`, `dev`, `db:generate`, `db:migrate`, `lint`, `lint:fix`, `test`, `test:watch`. Faltan:

- `typecheck`: nuevo task que ejecuta `tsc --noEmit` por paquete. No produce outputs cacheables, pero sí debe estar en el pipeline.
- `format:check`: nuevo task que ejecuta `prettier --check` por paquete (o en root, ya está definido en root `package.json`).

**Decisión:** añadir solo `typecheck` como task de Turbo. `format:check` se queda como script de root (no necesita pipeline, es un comando único). Esto minimiza el blast radius del cambio.

```json
"typecheck": {
    "dependsOn": ["^build"],
    "outputs": []
}
```

Depende de `^build` para forzar compilación de dependencias antes de chequear tipos: aunque `packages/database` expone `src/index.ts` como `types`, forzar el build garantiza que cualquier paquete que sí publique `dist/` tenga sus tipos listos. `outputs: []` desactiva el cacheo de outputs (porque `tsc --noEmit` no debería escribir nada). Si algún `tsconfig.json` tiene `incremental: true`, el writer del plan debe detectarlo y declarar los outputs del `.tsbuildinfo` (ver §10.5).

---

## 5. Composite Action: `.github/actions/setup/action.yml`

```yaml
name: 'Setup Monorepo'
description: 'Install pnpm, Node, and restore caches for the monorepo'
inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '20'
runs:
  using: 'composite'
  steps:
    - name: Setup pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 10

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}

    - name: Cache pnpm store
      uses: actions/cache@v4
      with:
        path: ~/.local/share/pnpm/store
        key: pnpm-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
        restore-keys: |
          pnpm-${{ runner.os }}-

    - name: Cache Turbo
      uses: actions/cache@v4
      with:
        path: .turbo
        key: turbo-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml', 'turbo.json', '**/package.json') }}
        restore-keys: |
          turbo-${{ runner.os }}-

    - name: Install dependencies
      shell: bash
      run: pnpm install --frozen-lockfile
```

Notas:

- `actions/setup-node@v4` ya añade `node_modules` al path (no hace falta cachearlo).
- `pnpm install --frozen-lockfile` falla si `pnpm-lock.yaml` está desincronizado con `package.json`s. Es la política correcta.
- Las `restore-keys` permiten fallback a una versión anterior del lockfile si la exacta no existe.

---

## 6. Hardening

| Medida                        | Implementación                                                                                                                                                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permissions mínimas           | `permissions: { contents: read }` por default en cada workflow                                                                                                                                                                                                                    |
| Pin de actions por SHA        | `ci.yml` y `ci-smoke.yml` pinean `actions/checkout@v4`, `actions/setup-node@v4`, `actions/cache@v4`, `actions/upload-artifact@v4`, `pnpm/action-setup@v4` por SHA. SHAs exactos se eligen al momento de implementar desde `dependabot.yml` (que mantiene el archivo actualizado). |
| Timeouts por job              | `lint`: 10min, `typecheck`: 15min, `format:check`: 5min, `unit`: 15min, `integration`: 25min, `build`: 20min                                                                                                                                                                      |
| Concurrency groups            | Sí (ver §3.3)                                                                                                                                                                                                                                                                     |
| Fail-fast                     | `continue-on-error: false` en todos los jobs (default)                                                                                                                                                                                                                            |
| Matrix Node                   | 20 y 22 en `ci.yml`. Stage 1 y jobs de Quality y Test corren con ambos. Stage 4 (build) corre solo con Node 22 (el default actual del repo según `Dockerfile.dev`).                                                                                                               |
| Branch protection documentado | En `docs/CI.md`, sección "Configuración requerida en GitHub"                                                                                                                                                                                                                      |

### 6.1 Matrix Node: detalle

La matrix se declara **a nivel de job**, no de workflow. Cada job declara su propio `strategy.matrix.node-version: [20, 22]` (excepto `build`, que es single-version: ver abajo).

```yaml
# En cada job de Quality y Test
strategy:
  fail-fast: false
  matrix:
    node-version: [20, 22]
```

`fail-fast: false` para que un fallo en Node 20 no cancele Node 22. Ambos deben pasar.

**Excepción — `build`:** corre **solo con Node 22** porque es la versión del runtime objetivo del repo (alineada con `Dockerfile.dev` que usa `node:26-alpine3.23` y con el `engines` de las apps). No es relevante gastar 2× tiempo en build de artefactos que no vamos a desplegar a Node 20. Razón documentada en `docs/CI.md`.

**Implicación para `needs:`:** cuando un job (e.g. `build`) hace `needs: [lint]`, GitHub Actions interpreta "todas las instancias de `lint` con cualquier matrix value" deben pasar. Es el comportamiento deseado: no se construye si lint falló en alguna versión.

### 6.2 Timeout values justificados

Basado en la experiencia local con Docker (punto de referencia):

- `pnpm install` cold: ~2-3 min, warm: ~10-30s
- `lint` cold: ~30s, warm: ~10s
- `typecheck` cold: ~3-5 min (56+ tablas, mucha inferencia), warm: ~30-60s
- `format:check`: ~5-10s
- `unit` (Vitest): ~1-2 min
- `integration` (Vitest + Postgres service start): ~3-5 min
- `build` (Next.js + NestJS): ~3-5 min cold, ~30-60s warm

Los timeouts tienen margen del 50-100% sobre el peor caso medido.

---

## 7. Workflow `ci-smoke.yml`

Corre una vez al día y verifica que el setup del CI sigue vivo. Es un subset mínimo del pipeline:

```yaml
name: CI Smoke
on:
  schedule:
    - cron: '0 6 * * *' # 06:00 UTC diario
  workflow_dispatch:

jobs:
  smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
        with:
          node-version: '22'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint --affected
      - run: pnpm turbo run build --affected
```

Si falla, el equipo sabe que el setup está roto antes de que un dev lo descubra en su PR.

---

## 8. `dependabot.yml`

Solo actualiza workflows y actions. No toca dependencias de runtime (eso es otro sub-proyecto).

```yaml
version: 2
updates:
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
    groups:
      github-actions:
        patterns:
          - '*'
```

Mantiene los SHAs de las actions actualizados, alertando al equipo de versiones nuevas.

---

## 9. Documentación: `docs/CI.md`

Secciones:

1. **Cómo añadir un nuevo job** (template copy-paste).
2. **Troubleshooting**:
   - "El cache de pnpm no se restaura" → verificar hash de lockfile, ver logs de cache step.
   - "Integration tests fallan con ECONNREFUSED" → service container no saludable, ver health check.
   - "Typecheck lento" → `incremental: true` en tsconfig del paquete, ajustar outputs.
3. **Configuración requerida en GitHub** (branch protection):
   - Required status checks: `lint`, `typecheck`, `format:check`, `unit`, `integration`, `build` (con el nombre del job, no del workflow).
   - Require branches to be up to date.
   - Require linear history.
4. **Cómo añadir un secret** (sección intencionalmente mínima: hoy no hay secrets. Es el lugar donde documentar `TURBO_TOKEN` y `TURBO_TEAM` si en el futuro se activa remote cache).
5. **Tiempos esperados y SLAs internos**:
   - PR con cambios solo en una app: ~5-8 min warm.
   - PR con cambios en `packages/database`: ~10-15 min.
   - PR con cambios en `pnpm-lock.yaml`: ~12-18 min cold.

---

## 10. Cambios en código del proyecto (no workflows)

### 10.1 `turbo.json` — añadir `typecheck`

Ver §4.7. Cambio mínimo, no rompe nada existente.

### 10.2 `apps/backend/package.json` y `apps/frontend/package.json` — añadir script `typecheck`

```json
"typecheck": "tsc --noEmit"
```

(El paquete `database` no tiene `tsc` configurado, queda fuera. Si en el futuro se quiere, se añade.)

### 10.3 `packages/database/package.json` — añadir script `typecheck` (opcional)

Solo si el paquete tiene un `tsconfig.json` válido. Verificar primero.

### 10.4 `package.json` (raíz) — sin cambios

Los scripts root ya delegan a `turbo run <task>` para `lint`, `test`, `dev`, `build`. No requiere cambio para `typecheck` (será `pnpm turbo run typecheck` ad-hoc o desde CI).

### 10.5 `tsconfig.json` de cada paquete — verificar `incremental`

Si algún tsconfig tiene `incremental: true`, hay que añadir outputs en `turbo.json` para el task `typecheck`. Asumimos que no lo está (verificar al implementar).

---

## 11. Plan de verificación

### 11.1 Smoke test del CI mismo

1. Crear una rama `test/ci-bootstrap`.
2. Hacer un cambio trivial (agregar un comment en `README.md`).
3. Abrir PR → debe disparar `ci.yml` → debe pasar todos los jobs.
4. Verificar en logs:
   - Cache hit en segundo run (mismo lockfile).
   - Cache miss al cambiar `pnpm-lock.yaml`.
5. Mergear a `main` → segundo run de `ci.yml` debe pasar.

### 11.2 Cold cache test

1. En GitHub Actions UI → "Cancel workflow" + "Re-run all jobs" con opción de no restaurar cache.
2. O localmente: borrar `.turbo/`, `~/.local/share/pnpm/store`, correr el pipeline simulado.

### 11.3 Verificación de branch protection

1. Configurar branch protection en `main` con los required checks.
2. Intentar mergear una PR sin pasar CI → debe ser bloqueado.

### 11.4 Smoke diario

1. Después del merge, esperar al cron de las 06:00 UTC del día siguiente.
2. Verificar que `ci-smoke.yml` se ejecutó y pasó.
3. Verificar que `dependabot.yml` propone al menos una PR semanal.

---

## 12. Out of scope (recordatorio)

- Vercel Remote Cache, self-hosted remote cache, S3 cache.
- E2E Playwright.
- Coverage gates (`--coverage --coverageThreshold`).
- Security scanning (CodeQL, Snyk).
- Release automation.
- Docker publish.
- Self-hosted runners.
- Migración a flat ESLint config.
- Cache de `node_modules` per-paquete (confiamos en pnpm store global + symlinks de workspace).

---

## 13. Riesgos y mitigaciones

| Riesgo                                                       | Mitigación                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| El composite action se rompe al cambiar versiones de actions | Dependabot semanal + smoke diario detecta drift                                                            |
| Cache de pnpm se vuelve muy grande                           | `actions/cache@v4` con eviction automática. Si pasa de 10GB por repo, revisar.                             |
| Service container de Postgres no levanta en runner           | Health check explícito + retry; documentado en CI.md                                                       |
| `typecheck` revela errores pre-existentes                    | Se permite PR dedicado para arreglar typecheck antes de mergear el CI. Documentar como "PR #0" en el plan. |
| Matrix Node 22 vs 20 falla por incompatibilidad              | `fail-fast: false` permite ver ambos resultados; fix es independiente                                      |
| Branch protection muy estricto bloquea hotfix                | Documentar procedimiento de "skip-ci" label + bypass (ver §6.2 de `docs/CI.md`)                            |
| SHAs de actions se quedan desactualizados                    | Dependabot semanal; PR auto-mergeable con un click                                                         |

---

## 14. Evolución futura (no en este sub-proyecto)

Cuando el equipo sienta la necesidad (probable cuando crezca el proyecto o se añada el frontend):

1. **Remote cache (5 líneas de cambio):** añadir `TURBO_TOKEN` y `TURBO_TEAM` como secrets, `env:` en cada job. No requiere tocar `turbo.json` ni la composite action.
2. **Coverage gates:** nuevo task `test:coverage` con threshold; cambiar `test` para fallar si coverage baja.
3. **E2e Playwright:** nuevo workflow `ci-e2e.yml` con browser install + Playwright; corre solo en `main` (no en PR por costo).
4. **Deploy:** nuevo workflow `deploy.yml` con providers (Vercel, Railway, etc.).
5. **Security scanning:** CodeQL workflow + Dependabot de dependencias npm.
6. **Docker publish:** build multi-stage + push a GHCR o DockerHub en tags.
7. **Self-hosted runner:** si el costo de GitHub-hosted escala, runner propio en infra del equipo.

---

## 15. Resumen ejecutivo

- **Qué:** pipeline de CI/CD con GitHub Actions, cache local vía `actions/cache`, sin dependencias externas.
- **Por qué:** no hay CI hoy; cualquier cambio llega a `main` sin verificación.
- **Cómo:** 2 workflows (`ci.yml`, `ci-smoke.yml`) + 1 composite action + `dependabot.yml` + `docs/CI.md`. Cambios mínimos en `turbo.json` y `package.json`s de los paquetes.
- **Cuánto cuesta:** $0 (GitHub-hosted runners en plan free del repo).
- **Cuánto tarda:** ~10-15 min cold, ~5-8 min warm, dependiendo del scope del cambio.
- **Riesgo principal:** nada bloqueante. Lo peor que pasa es que el primer run tarde más de lo esperado.
- **Próximo paso:** escribir el plan de implementación (writing-plans skill).
