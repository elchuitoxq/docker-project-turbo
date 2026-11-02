# S-20 — Maestros de bancos y conceptos de impuesto en la UI

| Campo      | Valor                                                                 |
| ---------- | --------------------------------------------------------------------- |
| Estado     | Implementado                                                          |
| Prioridad  | P1                                                                    |
| Alcance    | `apps/frontend` (configuración), `apps/frontend` (partners), semillas |
| Depende de | S-07, S-11, S-16                                                      |
| Fecha      | 2026-10-31                                                            |

## 1. Contexto

Dos rutas del menú de **Configuración** llevaban meses sin contenido: mostraban el cartel de módulo
pendiente aunque **el backend estaba completo**.

| Ruta                               | Backend                                                   | Estado previo |
| ---------------------------------- | --------------------------------------------------------- | ------------- |
| `/dashboard/settings/banks`        | `GET/POST/PATCH /v1/settings/banks`, `POST /:id/toggle`   | stub de UI    |
| `/dashboard/settings/tax-concepts` | `GET/POST /v1/settings/tax-concepts`, `PATCH/DELETE /:id` | stub de UI    |

Nadie podía dar de alta un banco ni un concepto de retención desde la aplicación. El catálogo de
bancos se sembraba a mano y las cuentas bancarias nuevas se quedaban sin banco; el maestro de
conceptos estaba **vacío en la base** y ningún formulario lo referenciaba.

## 2. Para qué sirve cada maestro

- **Bancos.** Es el catálogo del que cuelgan las cuentas de tesorería (`bank_accounts.bank_id`).
  Sin banco no se puede abrir una cuenta con sus datos completos, y la conciliación bancaria necesita
  saber a qué banco pertenece el extracto. No se borran: se desactivan, porque una cuenta con pagos
  históricos seguiría apuntando a un banco inexistente.
- **Conceptos de impuesto.** Es el catálogo de retenciones de ISLR (código, nombre, porcentaje, base
  mínima y sustraendo). Clasifica al proveedor en `partners.islr_concept_id` y es el punto de partida
  del cálculo de la retención.

## 3. Qué se implementó

### 3.1 Pantalla de bancos

- Listado con `ListCard`/`ListTh`/`ListTd` de `S-11`: código, nombre, fecha de alta, estado.
- Búsqueda por nombre o código (`ListFilters`).
- Alta y edición en diálogo (código de 4 dígitos + nombre).
- Interruptor y acción de menú para activar/desactivar (`POST /settings/banks/:id/toggle`).
- Permiso: `settings:banks:view` para leer y `settings:banks:manage` para escribir.

### 3.2 Pantalla de conceptos de impuesto

- Listado con código, concepto, porcentaje, base mínima, sustraendo y estado.
- Alta/edición con validación del porcentaje (0–100) y eliminación con confirmación del backend
  (si el concepto está en uso, el error se muestra tal cual).
- Interruptor para habilitar/deshabilitar sin borrar el histórico.
- Permiso: `settings:taxes:view` / `settings:taxes:manage`.

### 3.3 Enlace con el partner

El formulario de cliente/proveedor gana el campo **Concepto de ISLR**: guarda
`partners.islr_concept_id` con un selector de los conceptos habilitados. Sin esto el maestro quedaba
huérfano (nadie lo referenciaba) y la ficha del proveedor mostraba un porcentaje sin concepto.

### 3.4 Semilla

`seedTaxConcepts()` puebla los conceptos del Art. 79 de la Ley de ISLR para personas jurídicas
domiciliadas:

| Código   | Concepto                              | Retención |
| -------- | ------------------------------------- | --------- |
| ISLR-HON | Honorarios profesionales              | 5 %       |
| ISLR-COM | Comisiones mercantiles                | 3 %       |
| ISLR-SER | Servicios (excepto honorarios)        | 1 %       |
| ISLR-ARR | Arrendamiento de inmuebles            | 3 %       |
| ISLR-FLE | Fletes                                | 1 %       |
| ISLR-INT | Intereses y enriquecimiento sin causa | 3 %       |

El proveedor `Proveedor Internacional` queda clasificado con `ISLR-SER`, para que el maestro se vea
usado desde la ficha del partner.

## 4. Criterios de aceptación

1. `/dashboard/settings/banks` lista los bancos sembrados con su código y permite crear, editar y
   desactivar.
2. `/dashboard/settings/tax-concepts` lista los seis conceptos y permite crear, editar, habilitar y
   eliminar.
3. El formulario de partner guarda y muestra el concepto elegido.
4. La búsqueda filtra sin perder el encabezado de la tabla y el estado vacío explica qué hacer.
5. Crear un concepto desde la UI lo deja visible al instante (invalidación de caché).

## 5. Verificación ejecutada (2026-10-31)

| Comprobación                                       | Resultado                                        |
| -------------------------------------------------- | ------------------------------------------------ |
| `/settings/banks` en el navegador                  | 3 bancos sembrados (0108, 0137, 0105) con estado |
| `/settings/tax-concepts` en el navegador           | 6 conceptos con su porcentaje                    |
| Alta de un concepto desde la UI (`ISLR-TEST`, 2 %) | aparece en la tabla y el toast confirma          |
| Eliminación del mismo concepto                     | desaparece; vuelve a 6                           |
| Ficha del proveedor `Proveedor Internacional`      | selector "Concepto de ISLR" con `ISLR-SER` (1 %) |
| `pnpm --filter frontend test`                      | 387 pruebas OK (2 nuevas de contrato de API)     |
| `pnpm turbo run typecheck lint` / `build`          | 0 errores · 4/4                                  |
| `db:seed:dev` dos veces                            | 55/55 reglas, conceptos sin duplicar             |

**Defecto encontrado durante la verificación:** `formatMoney(x, 'Bs.S')` revienta con
`RangeError: Invalid currency code` porque `Intl.NumberFormat` sólo acepta códigos ISO. Las dos
celdas de importes del maestro usan `'VES'` y el formateador se encarga del símbolo.

## 6. Deuda que queda

- ~~La retención que se **aplica** en la compra se toma de `supplier_retention_settings`… el concepto
  debería alimentar la tasa cuando exista~~ → cerrado en [`S-21`](./S-21-regla-retencion-islr.md):
  concepto → tasa propia → parámetros, con la regla y el porcentaje guardados en el comprobante.
- `partners.retention_rate` ya participa: es el segundo nivel de precedencia cuando el proveedor no
  tiene concepto.
- Faltan pantallas equivalentes para **bancos de la empresa** (cuentas) y su conciliación contable
  (`S-19` dejó la llave `bank_account → cuenta contable`).
