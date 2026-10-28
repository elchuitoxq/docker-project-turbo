# Estado verificado del proyecto

> **Actualizado:** 2026-10-27. Este archivo es la fuente de verdad del estado
> observado; las casillas de `PROGRESS.md` y el plan de junio de `PLANNING.md`
> son snapshots históricos, y el avance del plan vive en
> [`sdd/04-plan-de-tareas.md`](./sdd/04-plan-de-tareas.md). Los resultados de
> tests registran el comando y el entorno donde se ejecutaron; las pruebas con
> PostgreSQL deben usar el entorno aislado descrito en `DATABASE-TESTING.md`.

## Resumen

| Área               | Estado observado                                                               | Evidencia / límite                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo           | Configurado con pnpm y Turborepo                                               | `package.json`, `pnpm-workspace.yaml`, `turbo.json`                                                                                           |
| Database           | Esquema Drizzle con moneda funcional, sucursal obligatoria y 21 migraciones    | `schema.ts`, `drizzle/0000…0020`; rollback por migración en [`DATABASE.md`](./DATABASE.md)                                                    |
| Pruebas PostgreSQL | Entorno aislado separado para `testdb_database` y `testdb_backend`             | [`DATABASE-TESTING.md`](./DATABASE-TESTING.md); 962 backend + 39 database verdes                                                              |
| Backend            | 22 controladores; autenticación JWT por cookie httpOnly y guards globales      | `ThrottlerGuard → JwtAuthGuard → PermissionsGuard → BranchContextGuard`; 12 controladores declaran `@RequirePermissions`                      |
| RBAC               | Seis roles de sistema con permisos verificados por rol                         | `seed-rbac.ts` declara 87 permisos; prueba de cobertura en `src/test/permissions-coverage.test.ts`                                            |
| Frontend           | Módulos de operaciones, inventario, finanzas, RR. HH., contabilidad y reportes | 164 pruebas; navegación y permisos sincronizados en `lib/navigation.ts` y `lib/permissions.ts`                                                |
| Multimoneda        | Moneda funcional VES, monto dual y bloqueo por tasa vencida                    | `lib/rates.ts`, `components/finance/stale-rate-gate.tsx`; E2E `stale-rate.spec.ts`                                                            |
| Aislamiento        | Probado en servicio, HTTP y navegador                                          | `src/test/branch-isolation.test.ts` + E2E `branch-isolation.spec.ts` sobre el build de producción                                             |
| Plan               | **100 de 100 tareas del WBS**                                                  | [`sdd/04-plan-de-tareas.md`](./sdd/04-plan-de-tareas.md); pendientes legales en `⚠️ P-28`                                                     |
| Nómina legal       | ISLR del Art. 50 aplicándose y guía interactiva de parámetros                  | `payroll/income-tax.ts`, `income_tax_brackets`, `/dashboard/settings/payroll-guide`; [`10-PARAMETROS-LEGALES.md`](./10-PARAMETROS-LEGALES.md) |
| Graphify           | Informe estático generado el 2026-06-10                                        | `graphify-out/GRAPH_REPORT.md`; no usar como verificación actual                                                                              |

## Seeds de desarrollo y pruebas RBAC

La seed determinista completa crea seis usuarios con contraseña común
`Test1234!`:

- `test-super-admin@test.local` → `SUPER_ADMIN`
- `test-admin@test.local` → `ADMIN`
- `test-manager@test.local` → `MANAGER`
- `test-seller@test.local` → `SELLER`
- `test-warehouse@test.local` → `WAREHOUSE`
- `test-accountant@test.local` → `ACCOUNTANT`

Asigna a cada cuenta los grants deterministas del rol y acceso a las dos
sucursales. `ADMIN` y `SUPER_ADMIN` tienen todos los permisos del catálogo de
68; la seed contiene 190 grants para sus seis roles y reconcilia esas
asignaciones al ejecutarse. Los runners aditivos conservan grants existentes.

`docker compose up --build` aplica las migraciones y ejecuta esta seed en la
base de desarrollo `mydb` antes de iniciar el backend. El runner exige
`SEED_ENV=development` y valida host local, puerto `5432` y nombre `mydb`. La
repetición reconcilia grants de los seis roles estándar y actualiza las cuentas
y registros deterministas de esta seed; no elimina otros datos ni restablece
el volumen Docker.

El flujo de pruebas sigue aislado: `pnpm db:seed:test` exige
`DATABASE_TEST_URL` local validada para `testdb_database` y la usa como
`DATABASE_URL`, sin permitir que la conexión de desarrollo cambie el destino.

Esto habilita probar la autenticación y visibilidad de UI por permiso. No
certifica autorización backend ni aislamiento por sucursal en todos los módulos.

## Resultados previos del entorno aislado

Verificado el 2026-10-23 en el entorno local:

- PostgreSQL aislado `mono-postgres-test` saludable en el puerto `5433`.
- `pnpm test:db:prepare`: migraciones aplicadas a `testdb_backend` y
  `testdb_database`.
- `pnpm db:seed:test`: terminó con código 0 y reportó 6 usuarios, 5 partners,
  10 productos, 5 facturas y 3 pagos. La idempotencia se ejercita además con dos
  ejecuciones dentro de la suite de integración.
- En esa corrida aislada, el login HTTP real contra una instancia temporal del
  backend en el puerto `4001`,
  configurada con `DATABASE_URL` hacia `testdb_database`: `test-admin@test.local`
  autenticó correctamente, devolvió rol JWT `ADMIN`, 66 permisos y 2 sucursales.
  La respuesta incluyó `tokenType: Bearer` y expiración de 604800 segundos. Una
  contraseña incorrecta fue rechazada con HTTP 401. La instancia temporal se
  detuvo al terminar; no se imprimió ni conservó el token.
- Consulta directa a `testdb_database`: 6 usuarios, 6 roles, 66 permisos,
  178 grants de rol (132 para ADMIN/SUPER_ADMIN), 6 asignaciones usuario-rol y
  12 asignaciones usuario-sucursal.
- `pnpm --filter database exec vitest run tests/integration/seed.test.ts`:
  10 pruebas aprobadas.
- `pnpm --filter database test`: 29 pruebas aprobadas en 5 archivos, incluidos
  los casos de validación de URL.
- `pnpm --filter backend exec vitest run src/modules/auth/auth.service.test.ts`:
  11 pruebas aprobadas.
- `pnpm --filter frontend exec vitest run modules/partners`: 15 pruebas
  aprobadas.
- `pnpm --filter backend build` y `pnpm --filter frontend exec tsc --noEmit`:
  correctos.
- Prettier check de los archivos modificados: correcto.

El resto de las suites de backend/frontend y las pruebas end-to-end no se
ejecutaron en esta verificación.

## Integración de empresas, sucursales y RBAC (2026-10-23)

- `0003_explicit_companies_rbac.sql` está aplicada en `mydb` (`localhost:5432`)
  y registrada por Drizzle. Crea `companies`, añade `branches.company_id`,
  elimina `branches.tax_id` y agrega restricciones RBAC y de sucursal
  predeterminada. El snapshot `0003_snapshot.json` enlaza con `0002`; el SQL
  manual conserva el backfill de datos.
- Al aplicar la migración en desarrollo, se encontraron seis asignaciones
  huérfanas a usuarios inexistentes. Con autorización se eliminaron únicamente
  esas filas de asignación (dos de `users_roles`, cuatro de `users_branches`);
  no se borraron usuarios ni roles. El backfill creó empresas según los RIF
  existentes y no fusionó automáticamente empresas con RIF distintos.
- Después de identificar un HTTP 403 en `GET /v1/branches/companies`, el
  usuario autorizó ejecutar solo `seedRbac()` contra el destino verificado
  `mydb:5432`. Se sincronizaron los 68 códigos declarados en la seed con modo
  aditivo; no se ejecutó `seed-test`, `seed-prod` ni una seed de negocio.
- Verificación posterior: login con `test-admin@test.local` devolvió 68
  permisos y una sucursal asignada. `ADMIN` y `SUPER_ADMIN` obtuvieron
  `settings:companies:view` y `settings:companies:manage`. El navegador abrió
  Usuarios, Roles y Empresas/Sucursales sin respuestas API 4xx; esta última
  mostró dos empresas y dos sucursales.
- El frontend omite solicitudes de contexto sin permisos de lectura, limita
  acciones de gestión por sus grants y espera la carga del contexto antes de
  decidir que falta una empresa o sucursal.
- Los selectores globales se apilan dentro de la barra lateral y el popover
  adopta el ancho de su botón con colisión contra el viewport. En navegador se
  comprobó que no se desbordan con el panel expandido a 1100 px ni a 390 px.
  Implementación en `components/layout/company-context-switcher.tsx` y
  `components/ui/combobox.tsx`.
- Pruebas ejecutadas en esta revisión: `modules/branches/hooks.test.tsx` (4/4)
  y `components/auth/permissions-gate.test.tsx` dentro de una corrida conjunta
  (10/10 entre ambos archivos); typecheck correcto y ESLint enfocado sin
  errores. Se observó una advertencia preexistente por `removeFavorite` sin uso
  en `app-sidebar.tsx`.

`mydb` es una base de desarrollo con datos propios, distinta de las bases
aisladas de test. Consultar [`DATABASE-TESTING.md`](./DATABASE-TESTING.md)
antes de ejecutar una seed; `pnpm db:seed:test` no sincroniza `mydb`.

Comandos reproducibles:

```bash
docker compose -f docker-compose.test.yml up -d postgres-test
pnpm test:db:prepare
pnpm db:seed:test
pnpm exec turbo run test --filter=database
pnpm exec turbo run test --filter=backend
```

No ejecutar la seed de pruebas contra `DATABASE_URL` de desarrollo. Para el
procedimiento, manejo de errores y cuentas de login, consultar
[`DATABASE-TESTING.md`](./DATABASE-TESTING.md).

## Próximos bloqueos funcionales

1. Implementar y probar autorización backend por rol/permisos; hoy los permisos
   de la sesión alimentan principalmente el gating del frontend.
2. Alinear contratos completos de Orders y Billing, incluido método de update,
   filtros, estados y respuestas.
3. Acordar la forma final del estado de cuenta y rango de fechas.
4. Mantener sincronizados el catálogo frontend de permisos y la seed RBAC.
5. Revalidar los indicadores históricos de `PROGRESS.md` con pruebas/ejecución
   reproducibles, sin inferir completitud solo por tener controlador o pantalla.
