# S-00 — Aislamiento por sucursal y auditoría de escrituras

| Campo          | Valor                         |
| -------------- | ----------------------------- |
| **Estado**     | ⬜ Especificada (no iniciada) |
| **Prioridad**  | 🔴 P0 — bloquea E1…E7         |
| **Depende de** | —                             |
| **Épica**      | E0                            |

---

## 1. Problema

El cliente web envía `x-branch-id` en cada request
([`lib/api/client.ts`](../../../apps/frontend/lib/api/client.ts)) pero el backend **no lo lee**:
no hay guard ni interceptor de sucursal. Un usuario asignado a la sucursal A puede:

- consultar datos de la sucursal B pasando `?branchId=B`,
- omitir el filtro y recibir el consolidado de toda la empresa,
- crear documentos en una sucursal a la que no tiene acceso.

Además, las escrituras sobre dinero/stock no siempre dejan rastro en `audit_logs`.

**Evidencia:** `grep -r "x-branch-id\|BranchInterceptor" apps/backend/src` → 0 resultados.

## 2. Alcance

**Incluye**

1. Guard global de contexto de sucursal + decorador `@CurrentBranch()`.
2. Filtrado obligatorio por sucursal en los servicios de negocio.
3. Permiso de acceso global (`core:branch:all`) para roles que lo requieran.
4. Auditoría automática de escrituras sensibles.
5. Inventario y corrección de tablas sin `branch_id`.

**No incluye**

- Multi-empresa simultánea en una sesión (hoy: empresa activa → sucursales asignadas).
- RLS de PostgreSQL (la aplicación filtra; RLS queda como endurecimiento futuro).

## 3. Historias de usuario

| ID   | Historia                                                                                     |
| ---- | -------------------------------------------------------------------------------------------- |
| HU-1 | Como usuario de la sucursal A, **no** puedo ver ni modificar datos de la sucursal B.         |
| HU-2 | Como usuario sin asignación a una sucursal, recibo `403` con un mensaje claro en la UI.      |
| HU-3 | Como auditor, puedo ver quién creó/anuló una factura, un pago o un movimiento de inventario. |
| HU-4 | Como SUPER_ADMIN, puedo operar en modo consolidado con el permiso `core:branch:all`.         |

## 4. Modelo de datos

- **Sin tablas nuevas.**
- Permiso nuevo: `core:branch:all` (seed RBAC, sólo `SUPER_ADMIN`).
- Auditoría: `audit_logs` ya existe; se agrega `branchId` si falta (verificar `schema.ts`).
- Tarea de inventario: listar tablas de negocio sin `branch_id` y evaluar una migración por tabla
  (`invoices`, `payments`, `orders`, `inventory_moves`, `payroll_runs`, `accounting_entries`,
  `credit_notes`, `loans`). `partners` puede ser compartido entre sucursales por diseño (documentar).

## 5. Contrato HTTP

| Cambio             | Detalle                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Request**        | Cabecera `x-branch-id: <uuid>` obligatoria en endpoints de negocio                                           |
| **Errores**        | `400` si falta la cabecera · `403` si la sucursal no está asignada · `404` si el recurso es de otra sucursal |
| **Compatibilidad** | Durante una release, aceptar `branchId` en query/body como fallback y registrar warning                      |
| **Swagger**        | Documentar la cabecera con `@ApiHeader` en un decorador reutilizable                                         |
| **Endpoint nuevo** | `GET /v1/auth/me` ya devuelve `branches`; agregar `defaultBranchId` para que la UI tenga contexto inicial    |

## 6. UI/UX

- El selector de sucursal (ya existe en el layout) **debe bloquear** el dashboard hasta tener sucursal
  activa válida (hoy ya espera `hasHydrated`, pero no valida contra el backend).
- Si el backend responde `403`, mostrar pantalla de "sin acceso a esta sucursal" con cambio de sucursal.

## 7. Reglas de negocio

1. La sucursal activa **siempre** proviene del servidor validado, nunca de una preferencia local no verificada.
2. Un documento pertenece a una única sucursal; no se mueve entre sucursales.
3. Cambiar de sucursal invalida las queries de React Query (`queryClient.clear()`).
4. Los reportes consolidados requieren `core:branch:all` y se muestran con la etiqueta "Consolidado".
5. Toda escritura auditada guarda `userId`, `branchId`, `ipAddress` y `changes` (delta mínimo).

## 8. Criterios de aceptación (Gherkin)

```gherkin
Escenario: acceso cruzado bloqueado
  Dado un usuario con acceso solo a la sucursal A
  Cuando solicita GET /v1/billing/invoices con x-branch-id = B
  Entonces recibe 403
  Y el cuerpo no revela datos de la sucursal B

Escenario: recurso de otra sucursal
  Dado un usuario con acceso solo a la sucursal A
  Cuando solicita GET /v1/billing/invoices/:id de un documento de B
  Entonces recibe 404

Escenario: consolidado autorizado
  Dado un SUPER_ADMIN con permiso core:branch:all
  Cuando solicita el consolidado sin x-branch-id
  Entonces recibe datos de todas las sucursales
  Y la respuesta se marca como consolidada

Escenario: auditoría de anulación
  Dado un pago publicado
  Cuando se anula
  Entonces existe un registro en audit_logs con action='void' y el delta
```

## 9. Plan de pruebas

| Tipo        | Caso                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Unitario    | `BranchContextGuard`: sin header → 400; sucursal no asignada → 403; con `core:branch:all` → pasa               |
| Integración | Factura de A no aparece en listado de B; `WHERE branch_id` presente en las 8 consultas críticas                |
| E2E         | Login como `test-seller@test.local` (1 sucursal) → intenta abrir documento de la otra → pantalla de sin acceso |
| Regresión   | Las 699 pruebas actuales siguen verdes tras exigir la cabecera                                                 |

## 10. Riesgos y migración

| Riesgo                            | Mitigación                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Romper la UI si falta la cabecera | Fallback a `branchId` query/body + warning durante una release                                   |
| Tablas sin `branch_id`            | Migración por tabla con backfill desde el documento padre; bloqueante sólo si hay datos cruzados |
| Ruido en auditoría                | Auditar sólo acciones sensibles (post, void, approve, pay, close, ajustes de stock)              |
