# Fase 6 — Turborepo, TypeScript, lint, tests e higiene

**Estado: ✅ Completada** · Verificación: `turbo run build` 4/4 · `typecheck` 6/6 · `lint` 4/4 · `test` 4/4.

## Turborepo (`turbo.json`)

- [x] `build.inputs` → `["$TURBO_DEFAULT$", ".env*"]`: ya no se ignoran `app/`, `components/`,
      `modules/`, `public/`, `postcss.config.mjs` ni `next.config.ts` (caché stale) `[H-33]`
- [x] `build.outputs` → `[".next/**", "!.next/cache/**", "dist/**"]` (caché mucho más chica)
- [x] `globalEnv: ["NODE_ENV", "CI"]` y `globalDependencies` (`tsconfig.base.json`, `pnpm-lock.yaml`) `[H-34]`
- [x] `build.env: ["NEXT_PUBLIC_*", "NEXT_OUTPUT", "NODE_ENV"]`
- [x] Nueva tarea `typecheck` (con `dependsOn: ["^build"]`) y `test:e2e`
- [x] `lint` ya no depende de `^build` (lintear no requiere compilar)
- [x] `db:generate` declara `outputs: ["drizzle/**"]`

## TypeScript

- [x] Nuevo `tsconfig.base.json` + `extends` en los 4 paquetes `[H-35]`
- [x] Frontend: `target: es5` → `ES2022`
- [x] Database: `strict: false` → `strict: true`; `module/moduleResolution` → `node16` (requerido por TS 6)
- [x] Backend: eliminado `ignoreDeprecations: "5.0"`; se mantiene `strictPropertyInitialization: false`
      (necesario para DTOs de Nest)
- [x] Scripts `typecheck` en los 4 paquetes

## Lint y formato

- [x] `eslint.config.mjs` raíz compartido + configs delgados por paquete (fase 1)
- [x] `lint-staged` sigue funcionando: al ejecutarse desde la raíz, ESLint resuelve la config del paquete
- [x] `.prettierignore` ampliado (artefactos, migraciones, tipos generados)

## Playwright

- [x] `webServer` que levanta el frontend automáticamente (`reuseExistingServer` fuera de CI) `[H-36]`
- [x] `timeout` 30 s, `expect.timeout` 10 s, `outputDir: test-results`
- [x] Artefactos en fallo: `screenshot`, `video`, `trace`
- [x] Reporter por entorno (`list` + `html` en CI)
- [x] Script raíz `test:e2e` y tarea `test:e2e` en Turbo

## Tests E2E (estaban obsoletos)

- [x] `e2e/tests/app.spec.ts`: eliminada la llamada a `/api/users` (el backend expone `/v1/users`) y las
      aserciones de texto que ya no existen; ahora valida `401` en endpoint protegido y `/health` `[H-37]`
- [x] `e2e/tests/login.spec.ts`: credenciales por `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` con defaults de seed `[H-37]`

## Higiene

- [x] `.gitignore`: `test-results/`, `playwright-report/`, `blob-report/`, `graphify-out/`, `.opencode/`,
      `packages/shared-types/openapi.json` `[H-39]`
- [x] `prepare: "husky install"` → `"husky"`; hooks sin la línea deprecada `_/husky.sh` `[H-38]`
- [x] `engines: { node: ">=20.19", pnpm: ">=10" }`
- [x] Eliminadas carpetas vacías `apps/frontend/tests/` y `apps/backend/src/common/filters` `[H-40]`
- [x] README corregido: "5 servicios" → lista real, `monorepo` → `backend`, `db:seed:rbac` → `db:seed:core`,
      NestJS 10 → 12, nuevos comandos (`typecheck`, `test:e2e`, `dev:docker:tools`) `[H-42]`

## Flakiness de tests (causa raíz corregida)

`use-products.test.tsx` y `use-partners.test.tsx` usaban `await new Promise(r => setTimeout(r, 50))`
para esperar la respuesta de MSW. Bajo carga, 50 ms no alcanzaban → fallos intermitentes
(se reprodujo 2 veces en 4 corridas). Reemplazado por `waitFor` de Testing Library
(sondeo hasta que se cumple la aserción). Resultado: **5 corridas consecutivas verdes**.

También se cambió `isolate: false` → `isolate: true` en `apps/frontend/vitest.config.ts` para evitar
fugas de estado entre archivos.

## Verificación (evidencia real)

| #   | Comando                                                          | Resultado                           |
| --- | ---------------------------------------------------------------- | ----------------------------------- |
| V-1 | `pnpm turbo run typecheck`                                       | ✅ 6/6                              |
| V-2 | `pnpm turbo run build`                                           | ✅ 4/4                              |
| V-3 | `pnpm turbo run lint`                                            | ✅ 4/4 (tras `lint:fix` de formato) |
| V-4 | `pnpm turbo run test`                                            | ✅ 4/4                              |
| V-5 | `pnpm --filter frontend exec vitest run` × 5                     | ✅ 75/75 en las 5 corridas          |
| V-6 | `node -e` parse de `.github/workflows/ci.yml` y `dependabot.yml` | ✅ YAML válido                      |
