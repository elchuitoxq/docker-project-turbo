# Contratos HTTP observados

> **Verificado contra el código:** 2026-10-23. Este documento registra el
> comportamiento implementado, no el contrato deseado por una especificación.
> La fuente ejecutable es el controlador/DTO/servicio de `apps/backend`; cuando
> el frontend difiere, la diferencia queda indicada como pendiente.

## Base URL y autenticación

- El backend declara las rutas versionadas directamente, por ejemplo
  `http://localhost:4000/v1/partners`.
- El cliente web construye la URL con
  `NEXT_PUBLIC_API_URL + NEXT_PUBLIC_API_PREFIX + path`; sus llamadas pasan
  paths como `/partners`. Configurar el prefijo del entorno como `/v1`.
- `POST /v1/auth/login` recibe `{ "email": string, "password": string }` y
  devuelve `{ accessToken, tokenType, expiresIn, user }`. `user` contiene
  `id`, `email`, `name`, `permissions` y `branches` (`id`, `name`, `companyId`,
  `taxId`).
  Los permisos se derivan de las relaciones usuario → rol → permiso; las
  sucursales de `users_branches`.
- El JWT incluye roles y permisos. La respuesta de login incluye permisos y
  sucursales para la UI.
- Los controladores de Users, Roles y Branches validan JWT y permisos de la
  sesión en cada solicitud administrativa. Partners, Orders y Billing siguen
  teniendo superficies sin esa autorización; no asumir que un permiso mostrado
  en la UI protege esos endpoints.

## Contexto de sucursal (obligatorio desde 2026-10-26)

Implementación: `apps/backend/src/common/branch/branch-context.guard.ts` (guard global)
y `apps/backend/src/common/decorators/current-branch.decorator.ts`.

- Toda petición a un endpoint de negocio debe declarar la sucursal activa en la
  cabecera **`x-branch-id: <uuid>`**. El guard la valida contra `users_branches`
  antes de que el controlador se ejecute.
- Resolución, en orden: cabecera `x-branch-id` → `branchId` en query/body
  (compatibilidad deprecada, deja warning) → si el usuario tiene **una sola**
  sucursal asignada se usa esa.
- Respuestas de error:
  - `400` — falta la cabecera y el usuario tiene varias sucursales, o el valor no es UUID.
  - `403` — la sucursal no está asignada al usuario, o el usuario no tiene sucursales.
  - `404` — el recurso existe pero pertenece a otra sucursal (no se filtra su existencia).
- Exentos (`@SkipBranch()`): `GET /v1/auth/me`, `/v1/health`, catálogo de
  empresas/sucursales y `/v1/settings/currencies` (necesarios antes de elegir sucursal).
- `core:branch:all` (sólo `SUPER_ADMIN`) habilita el modo consolidado sobre
  cualquier sucursal existente.
- `GET /v1/auth/me` devuelve además `defaultBranchId`, con la que la UI debe arrancar.
- Toda escritura sobre dinero o stock deja fila en `audit_logs` con `branch_id`,
  usuario, IP y el cuerpo saneado (ver `AuditWriteInterceptor`).

## Partners

Implementación: `apps/backend/src/modules/partners/`.

| Método | Ruta                 | Query/body                              | Respuesta real                                                                                       |
| ------ | -------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET    | `/v1/partners`       | `search` opcional (nombre, email o RIF) | Arreglo `PartnerResponseDto[]`                                                                       |
| GET    | `/v1/partners/stats` | —                                       | Conteo agrupado por tipo                                                                             |
| GET    | `/v1/partners/:id`   | —                                       | Un partner; 404 si no existe                                                                         |
| POST   | `/v1/partners`       | `CreatePartnerDto`                      | Partner creado; tipos `CUSTOMER` o `VENDOR`                                                          |
| PATCH  | `/v1/partners/:id`   | `UpdatePartnerDto`                      | Partner actualizado                                                                                  |
| DELETE | `/v1/partners/:id`   | —                                       | `{ message }`; actualmente solo pone `isSpecialTaxpayer` en `false`, no elimina/desactiva el partner |

El listado no implementa paginación ni filtro por tipo en backend. El cliente web
adapta el arreglo: envía `search` y pagina/filtra el resultado localmente. El
frontend usa los tipos backend `CUSTOMER` y `VENDOR`.

La ruta de borrado es una brecha: el servicio responde “deactivated” pero el
esquema de `partners` no tiene un campo de estado y el código solo modifica
`isSpecialTaxpayer`. No tratar esa operación como eliminación lógica.

El estado de cuenta **no** está bajo `/partners/:id/statement`. La ruta actual es
`GET /v1/treasury/statements/:partnerId`; no acepta fechas. Su forma es
`partnerId`, `partnerName`, `partnerTaxId`, `totalPaid`, `totalOutstanding`,
`creditBalance`, `recentPayments[]` y `outstandingInvoices[]`. No expone
movimientos ordenados, saldo de apertura/cierre ni rango de fechas como describe
el diseño anterior.

## Orders

Implementación: `apps/backend/src/modules/orders/`.

- `GET /v1/orders` acepta `status` y `partnerId`; devuelve un arreglo, no una
  envoltura `{ data, total, page, limit }`.
- `GET /v1/orders/:id` devuelve el pedido con sus ítems.
- Los estados del DTO son `DRAFT`, `CONFIRMED`, `PROCESSING`, `COMPLETED` y
  `CANCELLED`; los tipos son `SALE` y `PURCHASE`.
- El cliente frontend espera actualmente nombres/estados y respuesta paginada
  distintos. No presentar paginación ni estados `PENDING`/`APPROVED`/
  `INVOICED` como contrato backend vigente.

## Billing / invoices

Implementación: `apps/backend/src/modules/billing/`.

- `GET /v1/billing/invoices` acepta `branchId` y `status`; devuelve un arreglo
  `InvoiceResponseDto[]`. No implementa query `type` ni paginación.
- Los tipos son `SALE` y `PURCHASE`; los estados son `DRAFT`, `POSTED`, `PAID`
  y `VOID`.
- `GET /v1/billing/invoices/stats` acepta `branchId`.
- Actualizar factura es `PATCH /v1/billing/invoices/:id`, no `POST`.
- El cliente de Finance espera forma paginada, usa filtro `type` y llama con
  `POST` para actualizar. Esas expectativas no coinciden todavía con el backend.

## Branches

La entidad `companies` es explícita; `branches.company_id` la referencia y
`tax_id` vive en la empresa. La migración `0003_explicit_companies_rbac.sql`
crea empresas mediante backfill del RIF histórico y conserva como empresa
individual cada sucursal que no tenía RIF.

La relación es directa, no existe tabla intermedia:
`companies.id` ← `branches.company_id`. El RIF es un dato legal y no debe
usarse para resolver el vínculo ni agrupar sucursales. Ver [`DATABASE.md`](./DATABASE.md)
y `packages/database/src/schema.ts`.

| Método | Ruta                         | Autorización                      | Comportamiento                               |
| ------ | ---------------------------- | --------------------------------- | -------------------------------------------- |
| GET    | `/v1/branches/companies`     | JWT + `settings:companies:view`   | Empresas con sucursales asignadas al usuario |
| GET    | `/v1/branches/companies/all` | JWT + `settings:companies:manage` | Catálogo completo para configuración         |
| POST   | `/v1/branches/companies`     | JWT + `settings:companies:manage` | Crea una empresa                             |
| PATCH  | `/v1/branches/companies/:id` | JWT + `settings:companies:manage` | Actualiza datos/estado de empresa            |
| GET    | `/v1/branches`               | JWT + `settings:branches:view`    | Sucursales asignadas al usuario              |
| GET    | `/v1/branches/all`           | JWT + `settings:branches:manage`  | Catálogo completo para configuración         |
| GET    | `/v1/branches/:id`           | JWT + `settings:branches:view`    | Detalle; limitado a las sucursales asignadas |
| POST   | `/v1/branches`               | JWT + `settings:branches:manage`  | Crea sucursal bajo `companyId`               |
| PATCH  | `/v1/branches/:id`           | JWT + `settings:branches:manage`  | Actualiza sucursal/empresa                   |
| DELETE | `/v1/branches/:id`           | JWT + `settings:branches:manage`  | Desactiva sucursal                           |

Cada empresa incluye `id`, `taxId` (nullable), datos legales/de contacto,
`isActive`, `branchCount` y sucursales. `taxId` ya no se usa como identidad ni
como clave de agrupación.

## Users

Todas las rutas requieren JWT. Los permisos son `settings:users:view` para
lectura, `settings:users:create` para creación, `settings:users:edit` para
actualización y `settings:users:manage` para borrar y administrar
asignaciones.

- `GET /v1/users` y `GET /v1/users/:id` incluyen roles y sucursales; cada
  asignación incluye `companyId` e `isDefault`.
- `POST /v1/users` crea la cuenta. Las asignaciones se gestionan por endpoints
  separados para que el permiso de creación no permita escalar privilegios.
- `POST /v1/users/:id/roles` reemplaza los roles del usuario, validando los IDs
  y ejecutando la sustitución en una transacción.
- `POST /v1/users/:id/branches` reemplaza sus sucursales y predeterminada en
  una transacción. No admite sucursales inexistentes o inactivas.
- `PATCH /v1/users/:id` actualiza datos de la cuenta; `DELETE` elimina la cuenta.

La base impone claves foráneas y como máximo una sucursal predeterminada por
usuario. La API garantiza que una lista no vacía tenga exactamente una
predeterminada; una lista vacía es válida.

## Roles y permisos

Todas las rutas requieren JWT. `GET /v1/roles` y `GET /v1/roles/permissions`
requieren `settings:roles:view`; crear, actualizar y eliminar roles requieren
`settings:roles:manage`.

- `POST /v1/roles` recibe `name`, `description` opcional y `permissionIds`
  opcional.
- `PATCH /v1/roles/:id` actualiza un rol personalizado y reemplaza los grants
  únicamente cuando se proporciona `permissionIds`.
- `DELETE /v1/roles/:id` elimina solo roles personalizados no asignados.
- Los seis roles base tienen `isSystem: true`; el backend rechaza su edición y
  eliminación.
- `PermissionsGuard` vuelve a consultar los grants actuales del usuario en la
  base de datos por solicitud protegida, en lugar de confiar en los permisos
  potencialmente obsoletos del JWT.

## RBAC y datos de prueba

La seed mantiene seis roles de sistema y 68 permisos declarados en
`packages/database/src/scripts/seed-rbac.ts`. `ADMIN` y `SUPER_ADMIN` reciben el
catálogo completo; los demás roles reciben subconjuntos. La seed de pruebas
reconcilia las concesiones al repetirse; los otros runners agregan las
concesiones faltantes sin quitar grants existentes. Cuentas y contraseña de
pruebas se documentan en [`DATABASE-TESTING.md`](./DATABASE-TESTING.md).

Los nombres de permisos del frontend y la seed deben mantenerse sincronizados.

En el desarrollo verificado el 2026-10-23, `mydb` (`localhost:5432`) tenía
aplicada la migración `0003` y se ejecutó `seedRbac()` de forma puntual,
aditiva y autorizada para corregir un 403 en `GET /v1/branches/companies`. No
se ejecutó una seed completa. El catálogo y los grants de `ADMIN` y
`SUPER_ADMIN` quedaron con 68 permisos, incluidos
`settings:companies:view` y `settings:companies:manage`. El login de prueba
confirmó que `test-admin@test.local` recibe 68 permisos y una sucursal
asignada. No confundir `mydb` con `testdb_database`, que usa el puerto 5433.

## Integración frontend de Users, Roles y Branches

- Usuarios y roles consumen los endpoints administrativos descritos arriba y
  condicionan las acciones de gestión a los grants disponibles.
- La página de empresas y sucursales consulta `/companies/all` y `/all` solo
  con permisos de gestión; con permisos de lectura usa los listados limitados
  al usuario actual.
- Los hooks de contexto omiten solicitudes si la sesión no tiene los permisos
  de lectura. El shell espera la respuesta de empresas antes de decidir que
  falta el contexto.
- El selector de empresa/sucursal se apila en la barra lateral; el popover
  sigue el ancho del botón y respeta los límites del viewport en escritorio y
  móvil.
- La verificación manual del 2026-10-23 abrió Usuarios, Roles y
  Empresas/Sucursales sin errores HTTP 4xx tras sincronizar RBAC. Esto verifica
  el flujo actual de desarrollo, no todas las combinaciones de permisos ni
  sustituye pruebas de autorización backend.

## Nómina: parámetros y conceptos (desde 2026-10-27)

`T-02-01` y `T-02-02`. Las reglas de cálculo están en
[`09-HR-NOMINA-VENEZUELA.md`](./09-HR-NOMINA-VENEZUELA.md).

### Parámetros con vigencia

| Método  | Ruta              | Permiso              | Notas                                                                  |
| ------- | ----------------- | -------------------- | ---------------------------------------------------------------------- |
| `GET`   | `/v1/hr/settings` | `hr:settings:view`   | Devuelve **un valor por clave**, el vigente. Acepta `?asOf=YYYY-MM-DD` |
| `PATCH` | `/v1/hr/settings` | `hr:settings:manage` | Crea o actualiza la vigencia de la fecha indicada                      |

- Cuerpo del `PATCH`: `{ key, value, type?, label?, effectiveFrom? }`. Sin `effectiveFrom` se usa la
  fecha actual, normalizada al día: **dos altas del mismo día son la misma vigencia**.
- `type` `PERCENT`/`PERCENTAGE` se expresa como **porcentaje entero** (`4` = 4 %). Un valor fuera de
  `(0, 100]` responde `400`.
- Precedencia: valor de la sucursal sobre valor de empresa. Un valor cargado con `x-branch-id` no se
  filtra a otra sucursal.
- `GET` sin `asOf` devuelve lo vigente hoy; con `asOf` devuelve lo vigente en esa fecha (es lo que
  permite reproducir un período cerrado).

### Parámetros congelados de un run

`GET /v1/hr/payroll/:id/parameters` (`hr:payroll:view`) devuelve la copia de los parámetros tomada
al crear el run. Cambiar `payroll_settings` después **no** altera esa copia: responde `404` si el run
no existe.

### Conceptos de nómina

| Método   | Ruta                       | Permiso              |
| -------- | -------------------------- | -------------------- |
| `GET`    | `/v1/hr/concept-types`     | `hr:concepts:view`   |
| `POST`   | `/v1/hr/concept-types`     | `hr:concepts:manage` |
| `PATCH`  | `/v1/hr/concept-types/:id` | `hr:concepts:manage` |
| `DELETE` | `/v1/hr/concept-types/:id` | `hr:concepts:manage` |

- `category`: `ASSIGNMENT` \| `DEDUCTION` \| `EMPLOYER_CONTRIBUTION` \| `INFORMATIVE`.
- `kind`: `FIXED` \| `PERCENT` \| `FORMULA` \| `BASE`. Con `FORMULA` la `expression` es obligatoria.
- La `expression` se valida contra una gramática mínima: números, bases de cálculo
  (`SALARY_BASE`, `SALARY_NORMAL`, `SALARY_INTEGRAL`, `PERIOD_DAYS`, `MONTH_DAYS`, `HOURS`,
  `HOUR_RATE`, `UNITS`, `BASE_AMOUNT`), claves de parámetro de la empresa, `+ - * /` y paréntesis.
  Cualquier otro identificador o carácter responde `400`.
- `DELETE` responde `409` si el concepto es `isSystem` o si ya se usó en una nómina o en una
  incidencia. En ese caso se desactiva o se crea otro concepto.

## Nómina: motor de cálculo (desde 2026-10-27)

`T-02-03`. Las reglas que implementa están en
[`09-HR-NOMINA-VENEZUELA.md`](./09-HR-NOMINA-VENEZUELA.md) §6 y §8.

`POST /v1/hr/payroll/generate` calcula el run con el catálogo de conceptos de la empresa y los
parámetros congelados, no con constantes del código.

- **Naturaleza de las líneas** del recibo: `ASSIGNMENT`, `DEDUCTION`, `EMPLOYER_CONTRIBUTION`,
  `INFORMATIVE`. El neto es `asignaciones − deducciones`; el aporte patronal **no** lo reduce.
- `base` y `rate` de cada línea explican el cálculo: `rate` es la relación efectiva
  `monto / base` (por ejemplo `0,04` para el 4 % del seguro social).
- **Prórroga del período:** se paga por días y un período nunca paga más de un mes
  (31 días se tratan como 30).
- **Errores accionables:** si falta la tasa de cambio de una moneda, la respuesta es `400` con el
  parámetro que la necesita, por ejemplo:
  `Falta la tasa de cambio de USD al 2026-10-31: el parámetro CESTATICKET_USD está expresado en USD.`
- **Un run fallido no queda en el historial:** si el cálculo falla, el run se descarta completo.
- Si la sucursal no tiene empleados activos, el run se crea vacío (no es un error).

## Nómina: prestaciones, vacaciones y utilidades (desde 2026-10-27)

`T-02-04`. Las reglas están en [`09-HR-NOMINA-VENEZUELA.md`](./09-HR-NOMINA-VENEZUELA.md) §8.3 y §8.4.

| Método | Ruta                                    | Permiso              |
| ------ | --------------------------------------- | -------------------- |
| `GET`  | `/v1/hr/employees/:id/vacations?asOf=`  | `hr:employees:view`  |
| `POST` | `/v1/hr/employees/:id/vacations`        | `hr:payroll:process` |
| `GET`  | `/v1/hr/employees/:id/benefits?asOf=`   | `hr:payroll:view`    |
| `POST` | `/v1/hr/employees/:id/benefits/deposit` | `hr:payroll:process` |
| `POST` | `/v1/hr/employees/:id/profit-sharing`   | `hr:payroll:process` |

- El **salario integral diario** sale del motor de nómina, no de una fórmula paralela: prestaciones y
  utilidades usan exactamente el mismo cálculo que el recibo.
- `GET /vacations` devuelve `years`, `vacationDays`, `bonusDays`, `daysTaken`, `daysPending` y
  `normalDaily`. El día adicional empieza a contar desde el segundo año.
- `POST /vacations` paga vacaciones y bono sobre el salario normal diario; responde `400` si se piden
  más días de los que corresponden y `409` si el año ya está registrado.
- `GET /benefits` devuelve las **dos modalidades** (`guaranteeAccumulated`, `retroactive`), la que se
  paga (`payable`) y su nombre (`modality`: `GUARANTEE` | `RETROACTIVE`).
- `POST /benefits/deposit` registra la garantía de un trimestre (`year`, `quarter` 1-4,
  `isAnniversaryQuarter`). Es idempotente: el segundo intento responde `409`.
- `POST /profit-sharing` registra las utilidades del ejercicio (`year`, `monthsWorked` 1-12) con los
  días mínimos y el tope configurados; `409` si el ejercicio ya está registrado.
- Ninguna de estas operaciones exige la tasa de cambio: sólo se convierten los parámetros que las
  fórmulas involucradas realmente usan.

## Nómina: liquidación de egreso (desde 2026-10-27)

`T-02-05`. Reglas en [`09-HR-NOMINA-VENEZUELA.md`](./09-HR-NOMINA-VENEZUELA.md) §8.5.

| Método | Ruta                              | Permiso              |
| ------ | --------------------------------- | -------------------- |
| `GET`  | `/v1/hr/employees/:id/settlement` | `hr:payroll:view`    |
| `POST` | `/v1/hr/employees/:id/settle`     | `hr:payroll:process` |

Cuerpo del `POST`: `{ terminationDate, cause, notes? }`.

- `cause` admite `RENUNCIA`, `DESPIDO_JUSTIFICADO`, `DESPIDO_INJUSTIFICADO`, `MUTUO_ACUERDO`,
  `JUBILACION`, `MUERTE`, `INCAPACIDAD`. Una causa desconocida responde `400`.
- **Sólo `DESPIDO_INJUSTIFICADO` indemniza** (Art. 92). Las demás causas liquidan prestaciones,
  vacaciones, bono y utilidades, pero sin indemnización.
- La respuesta trae el desglose completo: `guaranteeAccumulated`, `retroactive`, `benefitsAmount`
  (la modalidad mayor), `vacationDays/Amount`, `bonusDays/Amount`, `profitDays/Amount`,
  `indemnificationDays/Amount` y `totalAmount`.
- El documento es **inmutable**: un segundo `POST` responde `409`. El empleado queda `TERMINATED`
  con la fecha y la causa.
- `GET` responde `404` mientras no exista liquidación.

## Nómina: pago del run contra tesorería (desde 2026-10-27)

`T-02-06`. Implementa RN-24: un run de nómina genera **un solo** movimiento de tesorería.

`POST /v1/hr/payroll/:id/pay` (`hr:payroll:process`)

Cuerpo: `{ methodId, bankAccountId?, exchangeRate?, date?, reference? }`.

- Registra **un** `payment` de tipo `EXPENSE` con `payrollRunId`, por el neto del run
  (`payroll_runs.totalAmount`), y marca el run como `PAID`.
- **Idempotente**: la segunda llamada no crea otro pago; devuelve el mismo con `alreadyPaid: true`.
  Además del control en el servicio, hay un índice único parcial sobre `payroll_run_id`.
- `payments.partnerId` queda **nulo** en los pagos de nómina: el beneficiario es un empleado, no un
  partner.
- `methodId` debe existir (`404` si no). Si el método afecta saldo (`CASH_*`, `POS`, `ZELLE`,
  `TRANSFER`) y se envía `bankAccountId`, se descuenta el monto de la cuenta.
- La tasa se toma del período; `exchangeRate` permite una tasa manual (auditable) y es obligatoria
  si la moneda del run no es la funcional y no hay tasa cargada (`400`).
- `400` si el run no tiene monto (`totalAmount` 0). `409` si el run figura `PAID` pero no tiene pago
  registrado (inconsistencia que hay que revisar, no tapar).

## Brechas pendientes

1. ~~Aplicar autorización backend a los controladores restantes~~ — **resuelto**: los guards
   son globales (`JwtAuthGuard` → `PermissionsGuard` → `BranchContextGuard`).
2. Definir si Partners, Orders y Billing deben implementar paginación/filtros
   servidor o si las vistas deben adoptar las respuestas sin paginar.
3. Resolver el contrato de Orders y la actualización/filtros de Billing.
4. Definir un estado de cuenta con los movimientos y filtros de fechas que
   necesita la vista, o simplificar la vista al resumen implementado.
5. Pendiente de la ola 1 (`S-00`): E2E de aislamiento entre sucursales contra el
   build de producción (T-00-12) y escritura de catálogo bajo `core:catalog:manage`.
