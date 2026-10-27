# S-06 — Reportes fiscales (Venezuela)

| Campo          | Valor                                                      |
| -------------- | ---------------------------------------------------------- |
| **Estado**     | ✅ Implementada (T-06-01 … T-06-06)                        |
| **Prioridad**  | 🟡 P2                                                      |
| **Depende de** | S-03 (compras/retenciones), S-04 (asientos)                |
| **Épica**      | E6 · **Fuente:** `audit-report/08-FISCALIDAD-VENEZUELA.md` |

> **Nota de implementación (2026-10-27):** los libros y el resumen ahora **filtran por sucursal** (H-78)
> y **convierten a moneda funcional** (H-79); el resumen ya no falla con fechas (H-77). La numeración
> correlativa vive en `fiscal_sequences` y las exportaciones en `fiscal_exports` con hash. El dígito
> verificador del RIF queda como **advertencia** hasta confirmar el tratamiento del residuo 10 contra la
> Providencia 0102. Los comprobantes de retención se siguen creando en E3, no aquí.

---

## 1. Problema

Existen endpoints de libro de ventas/compras y retenciones TXT/XML, pero **la UI no los usa** (llama
a `balance-sheet`/`income-statement`, que no existen) y no hay validaciones fiscales ni exportación
desde pantalla. Un error acá tiene consecuencia legal.

## 2. Alcance

1. **Libro de ventas** y **libro de compras** por período con totales por alícuota (16 %, 8 %, exento,
   exonerado) y base imponible.
2. **Retenciones**: comprobantes de IVA e ISLR en TXT y XML, con numeración correlativa por sucursal.
3. **Resumen fiscal**: IVA débito/crédito, IGTF, ISLR retenido, por período.
4. **Exportación** CSV/TXT/XML y descarga firmada del comprobante.
5. **Validaciones previas**: RIF válido, factura con número único, período sin cierres pendientes.
6. **UI**: `finance/reports` (reemplazar llamadas inexistentes), `finance/retentions` con descarga.

**No incluye:** transmisión automática al SENIAT (fuera de alcance; sólo generación de archivos
según formato documentado).

## 3. Historias de usuario

| ID   | Historia                                                                      |
| ---- | ----------------------------------------------------------------------------- |
| HU-1 | Como contador genero el libro de ventas del mes y cuadra con la contabilidad. |
| HU-2 | Como contador descargo el TXT/XML de retenciones de un proveedor.             |
| HU-3 | Como gerente veo el resumen de IVA e IGTF del período.                        |
| HU-4 | El sistema me avisa si un comprobante rompe la secuencia o hay RIF inválido.  |

## 4. Modelo de datos

| Tabla                                        | Cambio                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `invoices`, `credit_notes`, `tax_retentions` | Sin cambios estructurales; índices por `(branch_id, issue_date)`        |
| `tax_concepts`                               | Ya existe: alícuota, tipo (IVA/ISLR/IGTF), código de concepto           |
| **Nueva** `fiscal_sequences`                 | `(branchId, documentType, year)` → último correlativo (usada por S-03)  |
| **Nueva** `fiscal_exports`                   | Registro de archivos generados (hash, usuario, fecha) para trazabilidad |

## 5. Contrato HTTP

```
GET /v1/reports/fiscal/libro-ventas?from&to&branchId      → ya existe: completar totales y formato
GET /v1/reports/fiscal/libro-compras?from&to&branchId     → ya existe: completar
GET /v1/reports/fiscal/retenciones-txt?from&to&type=IVA|ISLR  → ya existe: devolver archivo
GET /v1/reports/fiscal/retenciones-xml?retentionId        → ya existe: XML del comprobante
GET /v1/reports/fiscal/summary?from&to                    → ya existe: ampliar a IVA/IGTF/ISLR
GET /v1/reports/fiscal/validation?from&to                 → nuevo: hallazgos previos a exportar
POST /v1/reports/fiscal/exports                           → nuevo: registra y devuelve archivo
```

Permisos: `reports:fiscal:view`, `reports:fiscal:export`.

## 6. UI/UX

- Filtros: rango de fechas, sucursal, tipo de documento.
- Tabla con totales fijos, indicador de "no cuadra con contabilidad" cuando difiere del asiento.
- Botones de descarga por formato y un panel de validaciones (errores bloquean la exportación).

## 7. Reglas de negocio

1. El libro incluye sólo documentos `POSTED`; las notas de crédito restan.
2. Totales por alícuota y base imponible deben cuadrar con la suma de líneas.
3. Los comprobantes de retención son inmutables una vez emitidos; corrección = nota de crédito.
4. La secuencia fiscal no admite huecos ni duplicados (`409`).
5. La exportación queda registrada con hash del archivo (trazabilidad).
6. El período de reporte no puede cruzar un cierre contable sin advertencia explícita.

## 8. Criterios de aceptación (Gherkin)

```gherkin
Escenario: libro de ventas cuadra
  Dado 3 facturas publicadas y 1 nota de crédito en el período
  Cuando genero el libro de ventas
  Entonces la base imponible y el IVA coinciden con los asientos
  Y la nota de crédito aparece restando

Escenario: exportación bloqueada por validación
  Dado un comprobante con RIF inválido
  Cuando intento exportar el TXT de retenciones
  Entonces recibe 409 con el detalle del hallazgo
  Y no se genera archivo

Escenario: formato XML
  Cuando descargo el XML de una retención
  Entonces contiene los nodos requeridos y el total retenido es correcto
```

## 9. Plan de pruebas

| Tipo        | Caso                                                            |
| ----------- | --------------------------------------------------------------- |
| Unitario    | Totales por alícuota; validación de RIF; correlatividad         |
| Integración | Facturas + NC → libro; retención → TXT/XML con formato esperado |
| E2E         | Contador genera libro del mes y descarga archivo                |
| Regresión   | Cifras de ejemplo validadas contra cálculo manual documentado   |

## 10. Riesgos

| Riesgo                       | Mitigación                                                                |
| ---------------------------- | ------------------------------------------------------------------------- |
| Formato fiscal incorrecto    | Archivos de ejemplo revisados contra la Providencia 0102 antes de liberar |
| Diferencias con contabilidad | Panel de validación que compara asientos vs libro                         |
| Cambios normativos           | Formatos parametrizados por año fiscal                                    |
