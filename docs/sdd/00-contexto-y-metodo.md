# 00 — Contexto y método

## 1. Qué es este proyecto

ERP para el mercado venezolano: monorepo pnpm + Turborepo con NestJS 12 (API), Next.js 16 (web),
Drizzle ORM + PostgreSQL 18 y un paquete compartido de tipos generados desde OpenAPI.

| Capa          | Ubicación                                                                | Estado de partida                                             |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Base de datos | [`packages/database`](../../packages/database)                           | 60 tablas, migraciones `0000`–`0004`, fuente única del schema |
| API           | [`apps/backend`](../../apps/backend)                                     | 22 controladores, 3 guards globales, Swagger, 699 tests       |
| Web           | [`apps/frontend`](../../apps/frontend)                                   | 22 rutas de dashboard + 3 de auth, 75 tests, 7 E2E            |
| Contratos     | [`apps/backend/docs/openapi.json`](../../apps/backend/docs/openapi.json) | generado por `pnpm openapi:export`                            |

## 2. Fuentes revisadas (y su fiabilidad)

| Documento                                        | Qué aporta                                                          | Fiabilidad                                 |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| [`docs/PROJECT-STATUS.md`](../PROJECT-STATUS.md) | Estado observado al 2026-10-23 y "Próximos bloqueos funcionales"    | **Alta** (declarado fuente de verdad)      |
| [`docs/API-CONTRACTS.md`](../API-CONTRACTS.md)   | Contrato HTTP real y divergencias con la web                        | **Alta** (verificado contra controladores) |
| `audit-report/08,09,07,10,13,15`                 | Reglas fiscales, nómina, tesorería, RBAC, mejoras y auditoría de BD | **Alta como requisito**, media como estado |
| [`docs/PROGRESS.md`](../PROGRESS.md)             | Bitácora histórica de junio                                         | **Baja** (el propio documento lo advierte) |
| [`docs/PLANNING.md`](../PLANNING.md)             | Plan original: 31 páginas, 14 módulos, 50+ tablas                   | **Media** (diseño deseado, no estado)      |
| `docs/update/**`                                 | Saneamiento de octubre (seguridad, deps, CI, Docker)                | **Alta** (con evidencia ejecutada)         |

> Donde este SDD dice "existe", se verificó en el código; donde dice "según el documento X", se
> cita la fuente.

## 3. Glosario mínimo

| Término            | Significado en este repositorio                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Sucursal**       | Unidad operativa (`branches`) hija de una `company`; casi todo dato de negocio es por sucursal |
| **Retención**      | Descuento de IVA/ISLR que el agente retiene al proveedor; genera comprobante TXT/XML           |
| **IGTF**           | Impuesto a grandes transacciones financieras (3 %) sobre pagos en divisa                       |
| **BCV**            | Tasa oficial del Banco Central de Venezuela (`exchange_rates`, cron `trigger-bcv`)             |
| **Kardex**         | Histórico de movimientos de inventario con costo (`inventory_moves`, `stock`)                  |
| **Asiento**        | Registro contable de doble partida (`accounting_entries`, `accounting_entry_lines`)            |
| **Cierre diario**  | Arqueo de caja/bancos por fecha (`treasury/daily-close`)                                       |
| **Nómina**         | `payroll_runs` → `payroll_items` → `payroll_item_lines` por período                            |
| **Slice vertical** | Cambio que atraviesa DB → API → UI → test y deja valor usable                                  |

## 4. Método de trabajo (SDD)

```
Especificar (esta carpeta) → Diseñar contrato (OpenAPI) → Implementar API + tests
        → Implementar UI + tests → Verificar (gate completo) → Documentar (bitácora)
```

**Regla de evidencia**: una feature no está "hecha" por tener controlador o pantalla.
Se exige prueba que demuestre el comportamiento (la lección de `PROGRESS.md`).

## 5. Qué NO incluye este SDD

- Reescritura de la arquitectura de módulos (ya es correcta).
- Multi-tenancy a nivel de base (hoy es multi-sucursal por fila).
- Integración con proveedores externos reales (SENIAT, bancos) más allá del contrato definido.
- Apps móviles o portal de clientes.

## 6. Convenciones de nombres de specs

`S-NN-tema.md` — `S` de spec, `NN` orden de ejecución sugerido. Cada spec declara:

```
Estado · Prioridad · Depende de · Épica
1. Problema     2. Alcance / No alcance    3. Historias de usuario
4. Modelo de datos   5. Contrato HTTP      6. UI/UX
7. Reglas de negocio 8. Criterios de aceptación (Gherkin)
9. Plan de pruebas   10. Riesgos / migración
```
