# Pruebas de base de datos

Las pruebas que necesitan PostgreSQL usan el servicio aislado definido en
`docker-compose.test.yml`. No apuntan a la base de desarrollo configurada por
`DATABASE_URL`.

La fuente de verdad del estado actual del proyecto es
[`PROJECT-STATUS.md`](./PROJECT-STATUS.md); los contratos observados se detallan
en [`API-CONTRACTS.md`](./API-CONTRACTS.md).

## Preparar y ejecutar

Requiere Docker Desktop o Docker Engine, pnpm y las dependencias del workspace
instaladas.

### Desarrollo con Docker Compose

`docker compose up --build` espera a PostgreSQL y, antes de iniciar el backend,
aplica las migraciones Drizzle y ejecuta la seed determinista completa del
entorno de desarrollo. La seed sincroniza los seis roles del sistema, los 68
permisos y 190 grants, una empresa con dos sucursales de prueba, cuentas para
los seis roles y datos funcionales para probar los módulos.

Credenciales del fixture:

| Usuario                       | Rol         | Contraseña  |
| ----------------------------- | ----------- | ----------- |
| `test-admin@test.local`       | ADMIN       | `Test1234!` |
| `test-super-admin@test.local` | SUPER_ADMIN | `Test1234!` |
| `test-manager@test.local`     | MANAGER     | `Test1234!` |
| `test-seller@test.local`      | SELLER      | `Test1234!` |
| `test-warehouse@test.local`   | WAREHOUSE   | `Test1234!` |
| `test-accountant@test.local`  | ACCOUNTANT  | `Test1234!` |

Esta seed está limitada intencionalmente a PostgreSQL local en el puerto `5432`
y a la base `mydb`; requiere además `SEED_ENV=development`. Es solo para
desarrollo, no para producción. Las migraciones son incrementales; la seed se
puede repetir y reconcilia grants de los seis roles estándar, además de
actualizar las cuentas y los registros deterministas que le pertenecen. No
borra el resto de los datos de la base ni restablece el volumen de Docker.

Para ejecutarla manualmente:

```powershell
$env:SEED_ENV = "development"
pnpm --filter database db:migrate
pnpm --filter database db:seed:dev
```

En Compose estas dos tareas ya se ejecutan automáticamente al iniciar el
backend. La seed de test descrita abajo continúa apuntando exclusivamente a
`testdb_database` por el puerto `5433`.

Los modos `dev`, `test`, `prod`, `core` y `faker` comparten un único runner
(`run-seed.ts`); los scripts de mantenimiento y diagnóstico siguen separados.

### Bases aisladas de test

```bash
# Iniciar PostgreSQL de pruebas (puerto local 5433)
docker compose -f docker-compose.test.yml up -d postgres-test

# Preparar bases y aplicar migraciones manualmente
pnpm test:db:prepare

# Sembrar datos deterministas en testdb_database
pnpm db:seed:test

# Ejecutar las pruebas del paquete database
pnpm exec turbo run test --filter=database

# Ejecutar las pruebas del backend
pnpm exec turbo run test --filter=backend

# Ejecutar todas las suites configuradas
pnpm test
```

Las tareas `test` de ambos paquetes dependen de `test:db:prepare`. Por eso, al
usar el flujo de Turbo, la preparación de las bases y las migraciones ocurre
antes de las suites, incluso cuando Turbo ejecuta los paquetes en paralelo.
`pnpm test:db:prepare` permite adelantar ese paso y comprobar la conexión.

## Aislamiento y seguridad

- `database` usa `testdb_database`; `backend` usa `testdb_backend`.
- El preparador y los helpers de prueba rechazan hosts no locales y nombres de
  bases distintos a los esperados. No se debe desactivar esta validación para
  ejecutar pruebas.
- Al limpiar fixtures se truncan las tablas del esquema `public`. El historial
  de migraciones, almacenado en el esquema `drizzle`, queda fuera de la limpieza.
- El contenedor usa el volumen `postgres_test_data`. Para detenerlo sin borrar
  datos, ejecuta `docker compose -f docker-compose.test.yml down` **sin** `-v`.
- No ejecutes `docker compose down -v` si quieres conservar el volumen de test.
  No es necesario borrar el volumen para repetir las pruebas.

Las URLs tienen valores locales predeterminados. Si se sobrescriben, configura
las siguientes variables con URLs PostgreSQL locales que mantengan exactamente
los nombres de base indicados:

| Variable                    | Base esperada     | Uso                                                             |
| --------------------------- | ----------------- | --------------------------------------------------------------- |
| `TEST_DATABASE_ADMIN_URL`   | `postgres`        | Crear las bases de test; el usuario requiere permiso `CREATEDB` |
| `BACKEND_TEST_DATABASE_URL` | `testdb_backend`  | Pruebas del backend                                             |
| `DATABASE_TEST_URL`         | `testdb_database` | Pruebas del paquete database                                    |

Las URLs de test deben apuntar al puerto local `5433`, además de conservar los
nombres de base indicados. El preparador y el runner de seed rechazan el puerto
`5432` de desarrollo. El `DATABASE_URL` de desarrollo no es un reemplazo válido
para estas variables.

`pnpm db:seed:test` valida `DATABASE_TEST_URL` y la fuerza como `DATABASE_URL`
del proceso antes de importar el módulo de conexión. La seed falla si la URL no
apunta a PostgreSQL local y a `testdb_database`. No se debe quitar esa validación
ni ejecutar manualmente el archivo de seed con otra conexión.

## Cuentas y datos de prueba

Todos los usuarios de esta seed usan la contraseña `Test1234!` y tienen acceso
a las dos sucursales sembradas (`Sucursal Caracas` y `Sucursal Maracaibo`):

| Correo                        | Rol         | Uso                     |
| ----------------------------- | ----------- | ----------------------- |
| `test-super-admin@test.local` | SUPER_ADMIN | Administración completa |
| `test-admin@test.local`       | ADMIN       | Administración completa |
| `test-manager@test.local`     | MANAGER     | Operación y aprobación  |
| `test-seller@test.local`      | SELLER      | Flujo de venta          |
| `test-warehouse@test.local`   | WAREHOUSE   | Inventario              |
| `test-accountant@test.local`  | ACCOUNTANT  | Finanzas y reportes     |

Las dos sucursales comparten una entidad `companies` con RIF
`J-12345678-9`; el selector agrupa por el ID de esa empresa y permite probar el
cambio entre Caracas y Maracaibo. Al repetir la seed, se reconcilian los datos
de la empresa y sucursales.

La seed de pruebas sincroniza los permisos de esos roles cada vez que se ejecuta:
los permisos sobrantes asignados manualmente a uno de esos roles se eliminan.
Este modo de reconciliación solo se usa para `seed-test`; los otros runners de
seed conservan su comportamiento aditivo. Las cuentas son fixtures locales; no
se deben reutilizar en producción.

La seed crea los grants RBAC y el inicio de sesión devuelve permisos y
sucursales al frontend. Users, Roles y Branches validan JWT y permisos desde la
API; otras áreas todavía tienen control de acceso pendiente. Revisar
[`API-CONTRACTS.md`](./API-CONTRACTS.md) para conocer el alcance exacto.

La migración `0003_explicit_companies_rbac.sql` debe aplicarse mediante el flujo
normal de migraciones. Hace backfill de las empresas históricas antes de
eliminar `branches.tax_id`, conserva las sucursales sin RIF como empresas
individuales y garantiza como máximo una sucursal predeterminada por usuario.
`pnpm test:db:prepare` la aplica solo en las bases aisladas de prueba; no usar
ese script como sustituto para migrar una base de desarrollo o producción.

El snapshot `drizzle/meta/0003_snapshot.json` representa el esquema posterior a
esa migración y enlaza con `0002_snapshot.json`. El SQL de `0003` es manual
porque incluye backfills de datos que no puede inferir Drizzle Kit; no se debe
reemplazar por el SQL generado automáticamente. Para comprobar que el esquema y
el snapshot siguen alineados, ejecuta `pnpm --filter database db:generate` y
confirma que Drizzle Kit no proponga cambios. En cada migración futura, revisa
juntos el SQL, el snapshot y la entrada correspondiente de `_journal.json`.

La seed modifica únicamente `testdb_database`; no cambia la conexión de otro
proceso. Para iniciar sesión desde la UI con estas cuentas, el backend que
atiende el frontend también debe arrancarse explícitamente con
`DATABASE_URL` apuntando a la misma URL aislada (`DATABASE_TEST_URL`, puerto
`5433`). No cambies el `.env` de desarrollo para conseguirlo ni apuntes el
backend de pruebas a la base del puerto `5432`.

El dashboard del `docker-compose.yml` de desarrollo usa `mydb` en el puerto
`5432`; por tanto, no muestra automáticamente los usuarios ni sucursales de esta
seed. En desarrollo, el selector agrupa sucursales asignadas por `company_id`;
el RIF se muestra como dato legal y no es la identidad de la empresa.

### Estado comprobado de la base de desarrollo (2026-10-23)

`mydb` ya tiene aplicada la migración `0003_explicit_companies_rbac.sql`.
Durante la aplicación se detectaron seis asignaciones huérfanas de usuarios:
con autorización se eliminaron dos filas de `users_roles` y cuatro de
`users_branches`, sin borrar cuentas ni roles. La migración se completó después
correctamente. El backfill derivó compañías a partir de los RIF históricos;
las sucursales con RIF distintos permanecieron asociadas a compañías
distintas.

Más tarde, un HTTP 403 en `GET /v1/branches/companies` se resolvió con una
ejecución explícitamente autorizada de `seedRbac()` contra el destino verificado
`mydb:5432`. Se añadieron los códigos y grants faltantes con su modo aditivo
predeterminado. **No** se ejecutó `seed-test`, `seed-prod` ni una seed de datos
de negocio. Por lo tanto, los usuarios, sucursales y empresas de `mydb` no son
necesariamente iguales a los fixtures de `testdb_database`.

Antes de investigar otro 403, identifica la URL exacta y confirma los grants
efectivos desde el esquema de base. No ejecutes una seed completa como atajo:
`seed-test` reconcilia los permisos de roles de prueba y sus datos son para el
entorno aislado de `5433`; el runner de producción además crea/configura otros
datos.

## Solución de problemas

- **No conecta al puerto 5433:** revisa `docker compose -f docker-compose.test.yml ps`
  y espera a que `postgres-test` esté healthy.
- **Error al crear bases:** confirma que la URL de administración conecte a la
  base `postgres` local y que el usuario tenga permiso `CREATEDB`.
- **Error al migrar:** revisa que las migraciones de `packages/database/drizzle`
  estén completas y vuelve a ejecutar `pnpm test:db:prepare`.
- **Se configuró una URL de base distinta:** el preparador o el helper fallará
  intencionalmente en lugar de limpiar o migrar una base no aislada.
