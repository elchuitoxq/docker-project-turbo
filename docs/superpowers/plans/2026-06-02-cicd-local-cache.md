# CI/CD con Caché Local — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poner en marcha un pipeline de CI/CD con GitHub Actions, caché local de pnpm y turbo, y jobs paralelos de lint/typecheck/format/test/build, sin secrets externos ni cuentas de terceros.

**Architecture:** 2 workflows (ci.yml principal + ci-smoke.yml diario) + 1 composite action reutilizable (.github/actions/setup) + 1 dependabot.yml para updates de actions + docs/CI.md. Cambios mínimos en turbo.json (nuevo task `typecheck`) y package.json de los paquetes. La verificación se hace empujando a una rama de prueba y observando el pipeline en la UI de GitHub.

**Tech Stack:** GitHub Actions (ubuntu-latest), pnpm 10, Turborepo 2.9, Node 20 + 22 (matrix), Postgres 18.4-alpine3.23 (service container).

**Spec:** `docs/superpowers/specs/2026-06-02-cicd-local-cache-design.md`

---

## Pre-requisitos (verificar antes de Task 1)

- [ ] **Acceso de push al repo** (o working desde un fork con PR al upstream). Sin esto, no se puede probar el pipeline.
- [ ] **GitHub CLI (`gh`)** instalado y autenticado (`gh auth status` debe listar la cuenta).
- [ ] **pnpm 10.x** instalado localmente.
- [ ] **Node 20.x o 22.x** instalado.
- [ ] **El proyecto debe ser un repositorio git** (ver Task 1 — si no lo es, `git init` + primer commit de bootstrap).

---

## Estructura de archivos

**Creados:**

- `.github/actions/setup/action.yml` — composite action (pnpm + node + cache)
- `.github/workflows/ci.yml` — pipeline principal (PR + push main)
- `.github/workflows/ci-smoke.yml` — cron diario
- `.github/dependabot.yml` — updates de actions
- `docs/CI.md` — troubleshooting + cómo añadir jobs

**Modificados:**

- `turbo.json` — añadir task `typecheck`
- `apps/backend/package.json` — script `typecheck`
- `apps/frontend/package.json` — script `typecheck`
- `packages/database/package.json` — script `typecheck`

---

## Task 1: Verificar entorno, inicializar git y crear estructura

**Files:**

- Create: `.github/` (directorio)
- Create: `.github/actions/setup/` (directorio)
- Create: `.github/workflows/` (directorio)

- [ ] **Step 1: Verificar que el proyecto sea un repo git**

Run: `git -C "C:\Users\elchu\Documents\Proyectos\docker-project-turbo" rev-parse --is-inside-work-tree 2>$null; if ($?) { Write-Host "Es repo git" } else { Write-Host "NO es repo git" }`

Si imprime "NO es repo git":

Run:

```bash
cd "C:\Users\elchu\Documents\Proyectos\docker-project-turbo"
git init
git add .
git commit -m "chore: bootstrap git repo for CI/CD work"
```

Expected: repo inicializado, primer commit creado. Si ya era repo, salta este paso.

- [ ] **Step 2: Verificar herramientas**

Run:

```bash
gh --version
pnpm --version
node --version
```

Expected: las tres retornan versión. `gh` debe estar autenticado:

Run: `gh auth status`

Expected: lista la cuenta autenticada con scopes `repo`, `workflow`.

Si `gh` no está autenticado, el ingeniero debe correr `gh auth login` antes de continuar.

- [ ] **Step 3: Crear la estructura de directorios**

Run (PowerShell):

```powershell
New-Item -ItemType Directory -Path ".github\actions\setup" -Force | Out-Null
New-Item -ItemType Directory -Path ".github\workflows" -Force | Out-Null
```

Expected: los dos directorios se crean sin error.

- [ ] **Step 4: Verificar que las herramientas de validación YAML estén disponibles**

Run:

```bash
gh workflow --help | Select-String "list" 2>$null
```

Si la salida contiene "list", `gh` puede listar workflows (suficiente para validación indirecta más adelante).

- [ ] **Step 5: Verificar que el remoto `origin` apunta al repo correcto de GitHub**

Run: `git remote get-url origin`

Expected: URL del tipo `https://github.com/<owner>/<repo>.git` o `git@github.com:<owner>/<repo>.git`.

Si no hay remoto, el ingeniero debe añadirlo:

```bash
git remote add origin https://github.com/<owner>/<repo>.git
```

- [ ] **Step 6: Commit de la estructura vacía**

```bash
git add .github/
git commit -m "chore(ci): scaffold .github directory structure"
```

Expected: commit creado. Si `.github/` está vacío, git puede no commitear nada; en ese caso, añade un `.gitkeep`:

```bash
echo "# GitHub workflows" > .github/workflows/.gitkeep
echo "# Composite actions" > .github/actions/setup/.gitkeep
git add .github/
git commit -m "chore(ci): scaffold .github directory structure"
```

---

## Task 2: Añadir script `typecheck` a `apps/backend/package.json`

**Files:**

- Modify: `apps/backend/package.json` (campo `scripts`)

- [ ] **Step 1: Leer el package.json actual para confirmar el formato**

Run: `Get-Content -LiteralPath "apps\backend\package.json"`

Expected: objeto JSON con campo `scripts` que contiene `dev`, `build`, `start`, `test`, etc.

- [ ] **Step 2: Añadir el script `typecheck`**

Edita `apps/backend/package.json`. En el objeto `scripts`, añade (alfabéticamente después de `test:coverage` y antes de `lint`):

```json
"typecheck": "tsc --noEmit"
```

Resultado: el objeto `scripts` debe verse así:

```json
"scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix"
}
```

- [ ] **Step 3: Verificar el script localmente**

Run:

```bash
cd "C:\Users\elchu\Documents\Proyectos\docker-project-turbo"
pnpm --filter backend typecheck
```

Expected:

- Exit code 0.
- Output muestra el progreso de TypeScript.
- Si hay errores de tipo en código existente, también los reporta (esto es esperado — se arreglarán en Task 4 o se documentan).

Si falla con "tsc not found", verificar que `apps/backend/node_modules/.bin/tsc` existe:

```bash
Test-Path "apps\backend\node_modules\.bin\tsc.exe"
```

Si no existe, ejecutar `pnpm install` en la raíz.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/package.json
git commit -m "feat(backend): add typecheck script"
```

---

## Task 3: Añadir script `typecheck` a `apps/frontend/package.json`

**Files:**

- Modify: `apps/frontend/package.json` (campo `scripts`)

- [ ] **Step 1: Leer el package.json actual**

Run: `Get-Content -LiteralPath "apps\frontend\package.json"`

- [ ] **Step 2: Añadir el script `typecheck`**

Edita `apps/frontend/package.json`. En el objeto `scripts`, añade (alfabéticamente después de `test:coverage` y antes de `lint`):

```json
"typecheck": "tsc --noEmit"
```

Resultado: el objeto `scripts` debe verse así:

```json
"scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint app --ext .ts,.tsx",
    "lint:fix": "eslint app --ext .ts,.tsx --fix"
}
```

- [ ] **Step 3: Verificar el script localmente**

Run:

```bash
cd "C:\Users\elchu\Documents\Proyectos\docker-project-turbo"
pnpm --filter frontend typecheck
```

Expected: Exit code 0. Si Next.js reporta errores por falta de `.next/types/`, es porque no se ha hecho build antes. En ese caso:

```bash
pnpm --filter frontend build
pnpm --filter frontend typecheck
```

Si tras el build sigue fallando, documentar el error y continuar (se verá en CI también).

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/package.json
git commit -m "feat(frontend): add typecheck script"
```

---

## Task 4: Añadir script `typecheck` a `packages/database/package.json`

**Files:**

- Modify: `packages/database/package.json` (campo `scripts`)

- [ ] **Step 1: Leer el package.json actual**

Run: `Get-Content -LiteralPath "packages\database\package.json"`

- [ ] **Step 2: Añadir el script `typecheck`**

Edita `packages/database/package.json`. En el objeto `scripts`, añade (alfabéticamente después de `test:coverage` y antes de `lint`):

```json
"typecheck": "tsc --noEmit"
```

Resultado: el objeto `scripts` debe verse así:

```json
"scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix"
}
```

- [ ] **Step 3: Verificar el script localmente**

Run:

```bash
cd "C:\Users\elchu\Documents\Proyectos\docker-project-turbo"
pnpm --filter database typecheck
```

Expected: Exit code 0. El tsconfig del database excluye `src/scripts` (los seed scripts), por lo que solo se chequea `src/index.ts` y `src/schema.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/database/package.json
git commit -m "feat(database): add typecheck script"
```

---

## Task 5: Añadir task `typecheck` a `turbo.json`

**Files:**

- Modify: `turbo.json` (objeto `tasks`)

- [ ] **Step 1: Leer turbo.json actual**

Run: `Get-Content -LiteralPath "turbo.json"`

Expected: contiene los tasks `build`, `dev`, `db:generate`, `db:migrate`, `lint`, `lint:fix`, `test`, `test:watch`.

- [ ] **Step 2: Determinar outputs según tsconfigs**

Inspecciona los tres tsconfigs:

```bash
Get-Content "apps\backend\tsconfig.json" | Select-String "incremental"
Get-Content "apps\frontend\tsconfig.json" | Select-String "incremental"
Get-Content "packages\database\tsconfig.json" | Select-String "incremental"
```

Expected:

- backend: NO contiene `"incremental": true` (no genera `.tsbuildinfo`).
- frontend: contiene `"incremental": true` (genera `.tsbuildinfo` junto al tsconfig).
- database: NO contiene `"incremental": true`.

Frontend también tiene `"noEmit": true`, pero con `incremental: true`, igual genera `.tsbuildinfo` (es la caché de TypeScript). Ese archivo debe listarse en `outputs` para que turbo lo pueda restaurar.

- [ ] **Step 3: Añadir el task `typecheck`**

Edita `turbo.json`. En el objeto `tasks`, añade (alfabéticamente después de `test:watch` y antes de la última `}` del objeto):

```json
"typecheck": {
    "dependsOn": ["^build"],
    "outputs": ["apps/frontend/tsconfig.tsbuildinfo"]
}
```

Nota: solo se declara el `.tsbuildinfo` del frontend porque es el único paquete con `incremental: true`. Los demás no producen outputs al usar `--noEmit` sin incremental.

Resultado: el objeto `tasks` completo debe verse así:

```json
"tasks": {
    "build": {
        "dependsOn": ["^build"],
        "inputs": ["src/**/*", "tsconfig.json", "next.config.js"],
        "outputs": [".next/**", "dist/**"]
    },
    "dev": {
        "cache": false,
        "persistent": true
    },
    "db:generate": {
        "inputs": ["src/**/*", "drizzle.config.ts"],
        "cache": true
    },
    "db:migrate": {
        "cache": false
    },
    "lint": {
        "dependsOn": ["^build"]
    },
    "lint:fix": {
        "cache": false
    },
    "test": {
        "dependsOn": ["build"],
        "inputs": ["src/**/*", "app/**/*"],
        "outputs": ["coverage/**"]
    },
    "test:watch": {
        "cache": false,
        "persistent": true
    },
    "typecheck": {
        "dependsOn": ["^build"],
        "outputs": ["apps/frontend/tsconfig.tsbuildinfo"]
    }
}
```

- [ ] **Step 4: Verificar localmente**

Run:

```bash
cd "C:\Users\elchu\Documents\Proyectos\docker-project-turbo"
pnpm turbo run typecheck --filter=./apps/* --filter=./packages/*
```

Expected: Exit code 0. Verás logs de turbo ejecutando el task en cada paquete.

Si el comando reporta errores de tipo en código pre-existente, anota cuáles son y comunícalos antes de continuar. Se permiten pero deben documentarse en `docs/CI.md` (sección "Estado pre-existente").

- [ ] **Step 5: Verificar que turbo puede usar el cache**

Run (segunda vez, debería ser hit de cache):

```bash
pnpm turbo run typecheck --filter=./apps/* --filter=./packages/*
```

Expected: en los logs ves `cache hit` (o similar) para el task `typecheck` en al menos uno de los paquetes.

- [ ] **Step 6: Commit**

```bash
git add turbo.json
git commit -m "feat(turbo): add typecheck task with incremental cache for frontend"
```

---

## Task 6: Crear composite action `.github/actions/setup/action.yml`

**Files:**

- Create: `.github/actions/setup/action.yml`

- [ ] **Step 1: Obtener los SHAs actuales de las actions (hardening)**

Para pinear las actions por SHA (defensa contra supply-chain attacks), primero obtén el SHA de cada tag:

Run (PowerShell):

```powershell
# pnpm/action-setup
gh api repos/pnpm/action-setup/git/refs/tags/v4 --jq '.object.sha'

# actions/setup-node
gh api repos/actions/setup-node/git/refs/tags/v4 --jq '.object.sha'

# actions/cache
gh api repos/actions/cache/git/refs/tags/v4 --jq '.object.sha'

# actions/checkout
gh api repos/actions/checkout/git/refs/tags/v4 --jq '.object.sha'
```

Anota los 4 SHAs retornados. La composite action solo usa 2 de ellas (pnpm y cache); el checkout se usa directamente en cada workflow.

- [ ] **Step 2: Crear el archivo de la composite action**

Run: `New-Item -ItemType File -Path ".github\actions\setup\action.yml" -Force`

Edita el archivo para que contenga exactamente:

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

Nota: usamos `@v4` (tags) en la composite action porque es referenciada por `uses: ./.github/actions/setup` desde los workflows; los workflows son los que pineamos por SHA. Esto reduce la superficie a pinear (solo 4 actions, no 4 + las internas de la composite).

- [ ] **Step 3: Validar sintaxis YAML**

Run (PowerShell):

```powershell
$content = Get-Content -LiteralPath ".github\actions\setup\action.yml" -Raw
try {
    # PowerShell no tiene parser YAML nativo, pero podemos verificar que no haya tabs y que las claves importantes existan
    if ($content -match "name:") { Write-Host "OK: tiene 'name'" } else { Write-Host "FAIL: falta 'name'" }
    if ($content -match "description:") { Write-Host "OK: tiene 'description'" } else { Write-Host "FAIL: falta 'description'" }
    if ($content -match "inputs:") { Write-Host "OK: tiene 'inputs'" } else { Write-Host "FAIL: falta 'inputs'" }
    if ($content -match "runs:") { Write-Host "OK: tiene 'runs'" } else { Write-Host "FAIL: falta 'runs'" }
    if ($content -match "using: 'composite'") { Write-Host "OK: es composite" } else { Write-Host "FAIL: no es composite" }
    if ($content -match "uses: pnpm/action-setup@v4") { Write-Host "OK: usa pnpm" } else { Write-Host "FAIL: falta pnpm" }
    if ($content -match "uses: actions/setup-node@v4") { Write-Host "OK: usa setup-node" } else { Write-Host "FAIL: falta setup-node" }
    if ($content -match "uses: actions/cache@v4") { Write-Host "OK: usa cache" } else { Write-Host "FAIL: falta cache" }
    if ($content.Contains("`t")) { Write-Host "WARN: contiene tabs (usar espacios)" } else { Write-Host "OK: sin tabs" }
} catch {
    Write-Host "Error leyendo archivo: $_"
}
```

Expected: todos los checks "OK".

Para validación más estricta, opcionalmente:

```bash
# Si tienes actionlint instalado
actionlint -version
```

Si está disponible: `actionlint .github/actions/setup/action.yml` (debe pasar sin errores).

- [ ] **Step 4: Commit**

```bash
git add .github/actions/setup/action.yml
git commit -m "feat(ci): add composite setup action with pnpm+node+cache"
```

---

## Task 7: Crear `ci.yml` con Stage 1 (setup) y Stage 2 (lint)

**Files:**

- Create: `.github/workflows/ci.yml`

Esta es la primera versión del workflow: solo setup + lint. Vamos a iterar agregando más jobs en tasks posteriores.

- [ ] **Step 1: Obtener SHA de `actions/checkout@v4`**

Run:

```powershell
gh api repos/actions/checkout/git/refs/tags/v4 --jq '.object.sha'
```

Anota el SHA (lo llamaremos `<CHECKOUT_SHA>`).

- [ ] **Step 2: Crear el archivo inicial del workflow**

Run: `New-Item -ItemType File -Path ".github\workflows\ci.yml" -Force`

Edita el archivo para que contenga exactamente:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read

jobs:
  lint:
    name: Lint (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: [20, 22]
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@<CHECKOUT_SHA>
        with:
          fetch-depth: 1

      - name: Setup Monorepo
        uses: ./.github/actions/setup
        with:
          node-version: ${{ matrix.node-version }}

      - name: Run lint
        run: pnpm turbo run lint --affected
```

Sustituye `<CHECKOUT_SHA>` por el SHA que obtuviste en el paso anterior (sin los `<` `>`).

- [ ] **Step 3: Validar YAML**

Run (PowerShell, mismo patrón que Task 6):

```powershell
$content = Get-Content -LiteralPath ".github\workflows\ci.yml" -Raw
$checks = @(
    "name: CI",
    "on:",
    "pull_request:",
    "push:",
    "branches: [main]",
    "concurrency:",
    "permissions:",
    "contents: read",
    "jobs:",
    "lint:",
    "matrix:",
    "node-version: [20, 22]",
    "timeout-minutes: 10",
    "actions/checkout@",
    "./.github/actions/setup"
)
foreach ($c in $checks) {
    if ($content -match [regex]::Escape($c)) { Write-Host "OK: $c" } else { Write-Host "FAIL: $c" }
}
if ($content.Contains("`t")) { Write-Host "WARN: contiene tabs" } else { Write-Host "OK: sin tabs" }
```

Expected: todos los checks "OK".

Opcional con actionlint:

```bash
actionlint .github/workflows/ci.yml
```

- [ ] **Step 4: Push a una rama de prueba y verificar**

```bash
git checkout -b test/ci-bootstrap-lint
git push -u origin test/ci-bootstrap-lint
```

Ve a GitHub → repo → Actions → workflow "CI" → run correspondiente al push.

Expected: el job `lint` corre en Node 20 y Node 22 (matrix), ambos pasan en ~30-60s (warm cache) o ~3-5 min (cold).

Si falla, revisa los logs del job. Los fallos más probables en esta fase:

- "frozen-lockfile" inconsistente: ejecutar `pnpm install` localmente y commitear el lockfile actualizado.
- "Setup Monorepo" falla: verificar que la composite action es referenciable (path correcto).

Una vez que el job pasa en ambos Node versions, mergear a main:

```bash
git checkout main
git merge test/ci-bootstrap-lint
git push origin main
```

Verificar en GitHub que el push a main también dispara el workflow y pasa.

- [ ] **Step 5: Commit y limpieza (si es rama separada)**

Si los cambios están en una rama temporal, ya hiciste merge arriba. Si no:

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): add ci.yml with lint job on Node 20+22 matrix"
```

Borrar la rama de test si quedó:

```bash
git branch -d test/ci-bootstrap-lint
git push origin --delete test/ci-bootstrap-lint
```

---

## Task 8: Extender `ci.yml` con jobs `typecheck` y `format:check`

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Leer el ci.yml actual**

Run: `Get-Content -LiteralPath ".github\workflows\ci.yml"`

- [ ] **Step 2: Añadir los nuevos jobs**

Edita `.github/workflows/ci.yml`. Después del job `lint:` (después de su último `run:` y antes de la línea final con solo `---` o cierre), añade:

```yaml
typecheck:
  name: Typecheck (Node ${{ matrix.node-version }})
  runs-on: ubuntu-latest
  strategy:
    fail-fast: false
    matrix:
      node-version: [20, 22]
  timeout-minutes: 15
  steps:
    - name: Checkout
      uses: actions/checkout@<CHECKOUT_SHA>
      with:
        fetch-depth: 1

    - name: Setup Monorepo
      uses: ./.github/actions/setup
      with:
        node-version: ${{ matrix.node-version }}

    - name: Run typecheck
      run: pnpm turbo run typecheck --affected

format-check:
  name: Format check
  runs-on: ubuntu-latest
  timeout-minutes: 5
  steps:
    - name: Checkout
      uses: actions/checkout@<CHECKOUT_SHA>
      with:
        fetch-depth: 1

    - name: Setup pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 10

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Run format check
      run: pnpm format:check
```

Sustituye `<CHECKOUT_SHA>` por el mismo SHA que usaste en Task 7.

Nota: `format-check` no usa la composite action porque solo necesita `pnpm install` + `prettier`, no necesita cache de turbo (es un solo comando).

- [ ] **Step 3: Validar YAML**

```powershell
$content = Get-Content -LiteralPath ".github\workflows\ci.yml" -Raw
$checks = @(
    "typecheck:",
    "typecheck --affected",
    "format-check:",
    "format:check"
)
foreach ($c in $checks) {
    if ($content -match [regex]::Escape($c)) { Write-Host "OK: $c" } else { Write-Host "FAIL: $c" }
}
```

- [ ] **Step 4: Push y verificar**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): add typecheck and format-check jobs"
git push origin main
```

Ve a GitHub Actions → run correspondiente.

Expected: ahora hay 5 jobs totales (2 lint, 2 typecheck, 1 format-check), todos en verde. Typecheck debería tardar más que lint (~3-5 min cold).

Si typecheck falla por errores de tipo pre-existentes, **NO falles el task**: anota los errores y comunícalos al equipo. Se permitirán solo en esta primera corrida de CI. La fix queda como sub-proyecto aparte.

- [ ] **Step 5: Confirmar verde antes de continuar**

Solo continúa al siguiente task si los 5 jobs pasaron en GitHub Actions. Si hay fallos, itera el workflow hasta que pasen.

---

## Task 9: Extender `ci.yml` con Stage 3 (test: unit + integration)

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Añadir el job `unit`**

Edita `.github/workflows/ci.yml`. Después del job `format-check:` (después de su último `run:`), añade:

```yaml
unit:
  name: Unit tests (Node ${{ matrix.node-version }})
  runs-on: ubuntu-latest
  strategy:
    fail-fast: false
    matrix:
      node-version: [20, 22]
  timeout-minutes: 15
  steps:
    - name: Checkout
      uses: actions/checkout@<CHECKOUT_SHA>
      with:
        fetch-depth: 1

    - name: Setup Monorepo
      uses: ./.github/actions/setup
      with:
        node-version: ${{ matrix.node-version }}

    - name: Run unit tests
      run: pnpm turbo run test --affected
```

Sustituye `<CHECKOUT_SHA>`.

- [ ] **Step 2: Añadir el job `integration` con service container Postgres**

Después del job `unit:`, añade:

```yaml
integration:
  name: Integration tests
  runs-on: ubuntu-latest
  timeout-minutes: 25
  services:
    postgres:
      image: postgres:18.4-alpine3.23
      env:
        POSTGRES_USER: ci_user
        POSTGRES_PASSWORD: ci_pass
        POSTGRES_DB: ci_db
      ports:
        - 5432:5432
      options: >-
        --health-cmd "pg_isready -U ci_user"
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  env:
    DATABASE_URL: postgresql://ci_user:ci_pass@localhost:5432/ci_db
  steps:
    - name: Checkout
      uses: actions/checkout@<CHECKOUT_SHA>
      with:
        fetch-depth: 1

    - name: Setup Monorepo
      uses: ./.github/actions/setup
      with:
        node-version: '22'

    - name: Wait for Postgres
      run: |
        for i in {1..30}; do
          if pg_isready -h localhost -p 5432 -U ci_user; then
            echo "Postgres ready"
            exit 0
          fi
          echo "Waiting for Postgres... ($i)"
          sleep 2
        done
        echo "Postgres failed to start"
        exit 1

    - name: Generate migrations
      run: pnpm --filter database db:generate

    - name: Apply migrations
      run: pnpm --filter database db:migrate

    - name: Seed RBAC
      run: pnpm --filter database db:seed:rbac

    - name: Run integration tests
      run: pnpm --filter backend test -- --run src/test/integration.test.ts

    - name: Upload coverage
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: integration-coverage
        path: apps/backend/coverage
        retention-days: 7
```

- [ ] **Step 3: Validar YAML**

```powershell
$content = Get-Content -LiteralPath ".github\workflows\ci.yml" -Raw
$checks = @(
    "unit:",
    "turbo run test --affected",
    "integration:",
    "postgres:18.4-alpine3.23",
    "POSTGRES_USER: ci_user",
    "pg_isready",
    "db:generate",
    "db:migrate",
    "db:seed:rbac",
    "integration.test.ts",
    "upload-artifact@v4"
)
foreach ($c in $checks) {
    if ($content -match [regex]::Escape($c)) { Write-Host "OK: $c" } else { Write-Host "FAIL: $c" }
}
```

- [ ] **Step 4: Push y verificar**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): add unit and integration test jobs"
git push origin main
```

Ve a GitHub Actions.

Expected: ahora hay 9 jobs totales. Los nuevos:

- `unit` (2 instances, matrix Node 20+22) → ~1-2 min cada uno.
- `integration` (1 instance) → ~3-5 min (incluye arrancar Postgres, generar/aplicar migraciones, seed, correr tests).

Si el job `integration` falla con "ECONNREFUSED 127.0.0.1:5432":

- El service container no está saludable. Verificar los logs: el step "Wait for Postgres" debe pasar antes de continuar.
- Si los health checks fallan, verificar que la imagen `postgres:18.4-alpine3.23` existe (debería, es la misma que usa docker-compose).

Si falla con "permission denied" en la creación de la DB:

- Verificar que las credenciales en `services.postgres.env` coinciden con `env.DATABASE_URL`.

- [ ] **Step 5: Confirmar verde**

Solo continúa si los 9 jobs pasan.

---

## Task 10: Extender `ci.yml` con Stage 4 (build) y `needs`

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Añadir el job `build`**

Edita `.github/workflows/ci.yml`. Después del job `integration:`, añade:

```yaml
build:
  name: Build
  runs-on: ubuntu-latest
  needs: [lint, typecheck, format-check, unit, integration]
  timeout-minutes: 20
  steps:
    - name: Checkout
      uses: actions/checkout@<CHECKOUT_SHA>
      with:
        fetch-depth: 1

    - name: Setup Monorepo
      uses: ./.github/actions/setup
      with:
        node-version: '22'

    - name: Build all affected packages
      run: pnpm turbo run build --affected

    - name: Upload backend dist
      uses: actions/upload-artifact@v4
      with:
        name: backend-dist
        path: apps/backend/dist
        retention-days: 7

    - name: Upload frontend .next
      if: hashFiles('apps/frontend/.next/**') != ''
      uses: actions/upload-artifact@v4
      with:
        name: frontend-next
        path: apps/frontend/.next
        retention-days: 7
```

Sustituye `<CHECKOUT_SHA>`.

Notas:

- `build` corre solo con Node 22 (single-version, justificado en spec §6.1).
- `needs:` referencia los nombres de jobs. Con matrix, se interpretan como "todas las instances de ese job".
- El step de upload de frontend tiene un `if:` que evita fallar si Next.js no genera `.next/` (e.g. cuando `--affected` no incluye el frontend).

- [ ] **Step 2: Validar YAML**

```powershell
$content = Get-Content -LiteralPath ".github\workflows\ci.yml" -Raw
$checks = @(
    "build:",
    "needs: [lint, typecheck, format-check, unit, integration]",
    "turbo run build --affected",
    "backend-dist",
    "frontend-next",
    "apps/backend/dist"
)
foreach ($c in $checks) {
    if ($content -match [regex]::Escape($c)) { Write-Host "OK: $c" } else { Write-Host "FAIL: $c" }
}
```

- [ ] **Step 3: Push y verificar**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): add build job with artifact upload and needs dependencies"
git push origin main
```

Ve a GitHub Actions.

Expected: ahora 10 jobs (build corre después de los 9 anteriores; si alguno falla, build no se ejecuta gracias a `needs:`). El job `build` tarda ~3-5 min cold.

Si `build` falla, los motivos más probables:

- El paquete `frontend` aún no tiene nada que construir (es la fase 3 pendiente). Es esperable que `--affected` no lo incluya si no se ha tocado. La pipeline debería seguir verde.
- Backend tiene errores de compilación. Revisar logs.

- [ ] **Step 4: Confirmar pipeline completo verde**

Solo continúa si los 10 jobs (build incluido) pasan. El pipeline completo cold tarda ~12-18 min; warm ~5-8 min.

---

## Task 11: Crear `ci-smoke.yml`

**Files:**

- Create: `.github/workflows/ci-smoke.yml`

- [ ] **Step 1: Crear el archivo**

Run: `New-Item -ItemType File -Path ".github\workflows\ci-smoke.yml" -Force`

Edita el archivo:

```yaml
name: CI Smoke

on:
  schedule:
    - cron: '0 6 * * *' # 06:00 UTC diario
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  smoke:
    name: Smoke test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@<CHECKOUT_SHA>
        with:
          fetch-depth: 1

      - name: Setup Monorepo
        uses: ./.github/actions/setup
        with:
          node-version: '22'

      - name: Lint smoke
        run: pnpm turbo run lint --affected

      - name: Build smoke
        run: pnpm turbo run build --affected
```

Sustituye `<CHECKOUT_SHA>`.

Nota: este workflow es un subset mínimo. Si el setup (composite action, pnpm install) se rompe, este workflow lo detecta antes de que un dev lo sufra en su PR.

- [ ] **Step 2: Validar YAML**

```powershell
$content = Get-Content -LiteralPath ".github\workflows\ci-smoke.yml" -Raw
$checks = @(
    "name: CI Smoke",
    "schedule:",
    "cron: '0 6 * * *'",
    "workflow_dispatch:",
    "smoke:",
    "turbo run lint --affected",
    "turbo run build --affected"
)
foreach ($c in $checks) {
    if ($content -match [regex]::Escape($c)) { Write-Host "OK: $c" } else { Write-Host "FAIL: $c" }
}
```

- [ ] **Step 3: Disparar el smoke manualmente**

```bash
git add .github/workflows/ci-smoke.yml
git commit -m "feat(ci): add daily smoke workflow"
git push origin main
```

Trigger manual:

```bash
gh workflow run ci-smoke.yml
```

Verificar en GitHub Actions que el run se inicia y completa (~3-5 min).

- [ ] **Step 4: Confirmar**

Solo continúa si el smoke pasa.

---

## Task 12: Crear `dependabot.yml`

**Files:**

- Create: `.github/dependabot.yml`

- [ ] **Step 1: Crear el archivo**

Run: `New-Item -ItemType File -Path ".github\dependabot.yml" -Force`

Edita:

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

Nota: este dependabot solo actualiza actions (no toca dependencias npm; eso es otro sub-proyecto). El grupo `github-actions` agrupa todas las actualizaciones en un solo PR en vez de una por action.

- [ ] **Step 2: Validar YAML**

```powershell
$content = Get-Content -LiteralPath ".github\dependabot.yml" -Raw
$checks = @(
    "version: 2",
    "package-ecosystem:",
    'github-actions',
    "schedule:",
    "interval: weekly"
)
foreach ($c in $checks) {
    if ($content -match [regex]::Escape($c)) { Write-Host "OK: $c" } else { Write-Host "FAIL: $c" }
}
```

- [ ] **Step 3: Commit**

```bash
git add .github/dependabot.yml
git commit -m "feat(ci): add dependabot for github-actions updates"
git push origin main
```

Expected: en menos de 24h, dependabot abrirá un PR (o no, si no hay updates). No requiere acción inmediata; el plan continúa.

---

## Task 13: Crear `docs/CI.md`

**Files:**

- Create: `docs/CI.md`

- [ ] **Step 1: Crear el archivo**

Run: `New-Item -ItemType File -Path "docs\CI.md" -Force`

Edita:

````markdown
# CI/CD Pipeline

Documentación operativa del pipeline de CI/CD con GitHub Actions.

---

## Resumen

- **Workflows:** `.github/workflows/ci.yml` (PR + push main), `.github/workflows/ci-smoke.yml` (cron diario 06:00 UTC)
- **Composite action:** `.github/actions/setup/action.yml` (setup compartido: pnpm + node + cache)
- **Cache:** local vía `actions/cache`, sin secrets externos
- **Service container:** Postgres 18.4-alpine3.23 para integration tests
- **Matrix:** Node 20 y 22 en lint/typecheck/unit; Node 22 en build/integration/smoke

---

## Tiempos esperados

| Escenario                                         | Duración aproximada                      |
| ------------------------------------------------- | ---------------------------------------- |
| PR con cambios solo en `apps/backend`             | ~5-8 min warm                            |
| PR con cambios en `packages/database`             | ~10-15 min (afecta todos los dependents) |
| PR con cambios en `pnpm-lock.yaml`                | ~12-18 min cold (reinstala deps)         |
| Pipeline completo en main (sin cambios recientes) | ~3-5 min warm                            |
| Cold cache (primer run tras cache eviction)       | ~15-20 min                               |

---

## Configuración requerida en GitHub

### Branch protection para `main`

En GitHub → repo → Settings → Branches → Branch protection rules → Add rule:

- **Branch name pattern:** `main`
- ☑ Require a pull request before merging
- ☑ Require approvals: 1
- ☑ Dismiss stale pull request approvals when new commits are pushed
- ☑ Require status checks to pass before merging
  - Buscar y añadir estos checks (aparecen tras la primera corrida):
    - `lint`
    - `typecheck`
    - `format-check`
    - `unit`
    - `integration`
    - `build`
- ☑ Require branches to be up to date before merging
- ☑ Require linear history
- ☑ Do not allow bypassing the above settings

### Secrets

Hoy el pipeline no usa secrets. Si en el futuro se añade remote cache, los secrets a configurar son:

- `TURBO_TOKEN` — token de Vercel Remote Cache
- `TURBO_TEAM` — ID de la organización en Vercel

(No los añadas hasta que se decida activar remote cache; ver `docs/superpowers/specs/2026-06-02-cicd-local-cache-design.md` §14.)

---

## Cómo añadir un nuevo job

1. Decide si el job es parte del pipeline principal (`ci.yml`) o si merece su propio workflow.
2. Para `ci.yml`, copia la estructura de un job existente similar (ver `lint` o `typecheck` como plantillas).
3. Usa siempre la composite action `./.github/actions/setup` para setup.
4. Pinea las actions por SHA. Para obtener el SHA actual de un tag:
   ```bash
   gh api repos/<owner>/<action>/git/refs/tags/<tag> --jq '.object.sha'
   ```
5. Añade `timeout-minutes` apropiado (estima 2× el peor caso medido).
6. Si el job produce artefactos valiosos, usa `actions/upload-artifact@v4`.
7. Documenta el job en este archivo (sección "Tiempos esperados" + descripción breve).

### Plantilla mínima

```yaml
mi-job:
  name: Mi job (Node ${{ matrix.node-version }})
  runs-on: ubuntu-latest
  strategy:
    fail-fast: false
    matrix:
      node-version: [20, 22]
  timeout-minutes: 10
  steps:
    - name: Checkout
      uses: actions/checkout@<SHA>
      with:
        fetch-depth: 1
    - name: Setup Monorepo
      uses: ./.github/actions/setup
      with:
        node-version: ${{ matrix.node-version }}
    - name: Mi paso
      run: <comando>
```

---

## Troubleshooting

### El cache de pnpm no se restaura

- **Síntoma:** el step "Cache pnpm store" reporta "Cache not found" en cada run.
- **Causa probable:** la clave del cache cambia entre runs (e.g. el lockfile se modifica, o `hashFiles` no encuentra el lockfile).
- **Verificación:** revisa los logs del step. La clave efectiva se muestra al inicio.
- **Fix:** verifica que `pnpm-lock.yaml` está commiteado y que el step `actions/checkout` lo incluye (no debería ser excluido por `.gitignore` o `.dockerignore` accidentalmente).

### Integration tests fallan con `ECONNREFUSED 127.0.0.1:5432`

- **Síntoma:** el job `integration` no puede conectar a Postgres.
- **Causa:** el service container no quedó saludable antes de que los tests empezaran.
- **Verificación:** el step "Wait for Postgres" debe haber pasado (exit 0). Si no, ver sus logs.
- **Fix:** los health checks del service container están en el workflow. Si la imagen cambia o el runner tiene problemas, pueden necesitar ajuste (aumentar `--health-retries`).

### Typecheck revela errores pre-existentes

- **Síntoma:** el job `typecheck` falla con errores de TypeScript en código que ya estaba en `main`.
- **Causa:** el task `typecheck` no existía antes de este pipeline; los errores no eran bloqueantes en local.
- **Fix:** crear un PR dedicado a corregir los errores de tipo. Es un sub-proyecto aparte. Mientras tanto, el pipeline no se puede mergear a main sin que typecheck pase.

### `frozen-lockfile` falla

- **Síntoma:** `pnpm install --frozen-lockfile` retorna error "Lockfile is incompatible".
- **Causa:** alguien modificó `package.json` sin regenerar `pnpm-lock.yaml`.
- **Fix local:** `pnpm install` (regenera el lockfile), commitear ambos archivos.

### Acciones deprecation warnings

- **Síntoma:** GitHub muestra warning de que una action usa una versión de Node deprecada.
- **Fix:** dependabot actualizará las actions semanalmente. Si es urgente, mergear el PR de dependabot a mano.

---

## Estado pre-existente (al activar el pipeline)

Errores conocidos al momento de activar este pipeline. Documentados para tracking:

_(añadir aquí los errores de typecheck/lint que aparezcan en la primera corrida del CI; cada uno con su plan de resolución)_

---

## Referencias

- Spec: `docs/superpowers/specs/2026-06-02-cicd-local-cache-design.md`
- Plan: `docs/superpowers/plans/2026-06-02-cicd-local-cache.md`
- Turborepo: <https://turbo.build/repo/docs>
- GitHub Actions: <https://docs.github.com/en/actions>
````

- [ ] **Step 2: Validar**

```powershell
$content = Get-Content -LiteralPath "docs\CI.md" -Raw
$sections = @(
    "# CI/CD Pipeline",
    "## Resumen",
    "## Tiempos esperados",
    "## Configuración requerida en GitHub",
    "## Cómo añadir un nuevo job",
    "## Troubleshooting",
    "## Estado pre-existente",
    "## Referencias"
)
foreach ($s in $sections) {
    if ($content -match [regex]::Escape($s)) { Write-Host "OK: $s" } else { Write-Host "FAIL: $s" }
}
```

- [ ] **Step 3: Commit**

```bash
git add docs/CI.md
git commit -m "docs(ci): add CI.md with troubleshooting and how-to guide"
git push origin main
```

---

## Task 14: Verificación end-to-end y branch protection

**Files:**

- (no file changes, solo configuración en GitHub UI)

- [ ] **Step 1: Confirmar que el pipeline completo está verde**

Ve a GitHub → Actions → workflow "CI" → último run en main.

Expected: los 10 jobs pasan en verde (lint ×2, typecheck ×2, format-check, unit ×2, integration, build).

Si alguno está rojo, vuelve al task correspondiente y arregla. No continues hasta que esté todo verde.

- [ ] **Step 2: Disparar el smoke manualmente y confirmar**

```bash
gh workflow run ci-smoke.yml
```

Espera a que complete. Expected: verde en ~3-5 min.

- [ ] **Step 3: Verificar que el cron está registrado**

```bash
gh workflow list
```

Expected: lista `CI` y `CI Smoke`. Para `CI Smoke`, verifica que tiene schedule:

```bash
gh workflow view ci-smoke.yml
```

Expected: la salida incluye "on: schedule" y el cron `0 6 * * *`.

- [ ] **Step 4: Configurar branch protection en GitHub UI**

Sigue las instrucciones de `docs/CI.md` §"Configuración requerida en GitHub".

Acción específica: ve a GitHub → repo → Settings → Branches → Add rule con branch name pattern `main`, marca los checks listados en `docs/CI.md`, guarda.

- [ ] **Step 5: Probar branch protection con un PR de prueba**

```bash
git checkout -b test/branch-protection
echo "# test" >> README.md
git add README.md
git commit -m "test: verify branch protection"
git push -u origin test/branch-protection
gh pr create --title "Test branch protection" --body "Verifica que branch protection funciona" --base main
```

Ve a la PR. GitHub debe mostrar:

- "Require status checks to pass before merging" requiere los 6 checks en verde.
- Si el pipeline pasa, el botón "Merge" está habilitado (después de la aprobación).
- Si falla (e.g. simulas un fallo añadiendo un error de lint), el botón está deshabilitado.

- [ ] **Step 6: Limpiar la PR de prueba**

```bash
gh pr close <PR_NUMBER>
git checkout main
git branch -D test/branch-protection
git push origin --delete test/branch-protection
```

- [ ] **Step 7: Verificar que dependabot funciona (opcional, esperar 24h)**

Después de 24h, ve a GitHub → repo → Pull requests. Si dependabot abrió algún PR, revísalo (probablemente actualice `pnpm/action-setup` o `actions/cache` a una versión más nueva). Mergearlo es seguro.

- [ ] **Step 8: Commit final de seguimiento (si hubo cambios)**

Si durante la verificación modificaste algún workflow, commitea los ajustes:

```bash
git status
# Si hay cambios:
git add .github/
git commit -m "chore(ci): post-verification adjustments"
git push origin main
```

---

## Resumen de archivos tocados

**Creados (9 archivos):**

- `.github/actions/setup/action.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/ci-smoke.yml`
- `.github/dependabot.yml`
- `docs/CI.md`
- `docs/superpowers/specs/2026-06-02-cicd-local-cache-design.md` (ya existe desde brainstorming)
- `docs/superpowers/plans/2026-06-02-cicd-local-cache.md` (este archivo)

**Modificados (4 archivos):**

- `turbo.json` (nuevo task `typecheck`)
- `apps/backend/package.json` (script `typecheck`)
- `apps/frontend/package.json` (script `typecheck`)
- `packages/database/package.json` (script `typecheck`)

**Total de commits esperados:** ~12-14 (uno por task principal + ajustes).

---

## Criterios de éxito del plan

- [ ] Los 10 jobs del pipeline `ci.yml` pasan en verde en `main`
- [ ] El workflow `ci-smoke.yml` corre manualmente y pasa
- [ ] El cron de `ci-smoke.yml` está registrado
- [ ] Branch protection configurado en GitHub UI con los 6 required checks
- [ ] Una PR de prueba con un cambio trivial pasa el pipeline
- [ ] Una PR de prueba con un fallo (e.g. lint intencional) es bloqueada por branch protection
- [ ] `docs/CI.md` describe cómo añadir un job nuevo y cómo resolver los 5 problemas de troubleshooting listados
- [ ] No hay secrets configurados en el repo
- [ ] Dependabot abre al menos un PR en la primera semana (verificación diferida)
