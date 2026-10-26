# S-02 — Nómina Venezuela completa

| Campo          | Valor                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Estado**     | ⬜ Especificada                                                                                                        |
| **Prioridad**  | 🟠 P1                                                                                                                  |
| **Depende de** | S-00, S-01 (A)                                                                                                         |
| **Épica**      | E2 · **Fuente de reglas:** [`audit-report/09-HR-NOMINA-VENEZUELA.md`](../../../audit-report/09-HR-NOMINA-VENEZUELA.md) |

---

## 1. Problema

El backend calcula nómina (`payroll/generate`, `process`, `payslip`) pero **no expone parámetros,
conceptos, liquidación ni pago**, y el frontend espera 8 endpoints que no existen. El módulo es el
más regulado del ERP y hoy no es operable de punta a punta.

## 2. Alcance

1. **Parámetros** (`payroll_settings`): salario mínimo, unidad tributaria, cestaticket, alícuotas
   (IVSS, paro forzoso, FAOV), días base de vacaciones/bono/utilidades, política de redondeo.
2. **Conceptos** (`payroll_concept_types`): catálogo con tipo (ASIGNACIÓN/DEDUCCIÓN/APORTE_PATRONAL),
   fórmula declarativa y bandera `afectaSalarioIntegral`.
3. **Cálculo**: normal, integral, prestaciones (garantía trimestral + días adicionales), utilidades,
   vacaciones y bono vacacional, cestaticket, aportes patronales y retenciones (ISLR).
4. **Liquidación de empleado** (egreso): prestaciones + fracciones + indemnización según causa.
5. **Pago**: genera `payments` en tesorería contra la cuenta del empleado
   (`employee_bank_accounts`) con idempotencia por `payrollRunId`.
6. **UI**: parámetros, conceptos, ficha del empleado (`employees/[id]`), detalle de recibo
   (`payroll/[id]`) y botón de pago.

**No incluye:** cálculo de utilidades anuales como proceso masivo (queda como job posterior);
integración bancaria de archivo de pago (sólo se registra el pago).

## 3. Historias de usuario

| ID   | Historia                                                                              |
| ---- | ------------------------------------------------------------------------------------- |
| HU-1 | Como analista de nómina configuro parámetros legales por empresa sin tocar código.    |
| HU-2 | Como analista genero la nómina del período y veo el desglose por concepto y empleado. |
| HU-3 | Como gerente apruebo y pago la nómina; el pago aparece en tesorería y contabilidad.   |
| HU-4 | Como analista liquido un empleado que egresa y obtengo el monto por concepto.         |

## 4. Modelo de datos

| Tabla                               | Cambio                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `payroll_settings`                  | Ya existe: agregar `companyId`, vigencia (`effectiveFrom`) y unicidad por empresa+vigencia |
| `payroll_concept_types`             | Ya existe: agregar `code`, `kind`, `expression`, `affectsIntegralSalary`                   |
| `payroll_runs`                      | Ya existe: `status` (`DRAFT→CALCULATED→APPROVED→PAID→VOID`), `approvedBy`, `paidAt`        |
| `employee_profit_sharing`           | Ya existe: usar para utilidades                                                            |
| **Nueva** `payroll_period_settings` | Snapshot de parámetros usados en el run (inmutabilidad histórica)                          |
| **Nueva** `employee_settlements`    | Liquidación: `employeeId`, `reason`, `components jsonb`, `total`, `status`                 |

> Regla de oro: un `payroll_run` **congela** los parámetros usados; cambiar `payroll_settings`
> después no altera runs históricos.

## 5. Contrato HTTP

```
GET    /v1/hr/settings                  → parámetros vigentes (+ ?asOf=)
PATCH  /v1/hr/settings                  → nueva vigencia (no edita la anterior)
GET    /v1/hr/concept-types             → ya existe; agregar filtros
POST   /v1/hr/concept-types             → crear concepto
PATCH  /v1/hr/concept-types/:id         → editar (no si está usado en run cerrado)
POST   /v1/hr/payroll/generate          → { periodFrom, periodTo, branchId }
GET    /v1/hr/payroll/:id               → run + items + líneas
POST   /v1/hr/payroll/:id/process       → calcula/valida y pasa a CALCULATED
POST   /v1/hr/payroll/:id/approve       → APPROVED (permiso hr:payroll:approve)
POST   /v1/hr/payroll/:id/pay           → genera payments (idempotente) → PAID
GET    /v1/hr/payroll/:runId/payslip/:itemId → recibo (PDF/HTML)
POST   /v1/hr/employees/:id/settle      → liquidación
```

Permisos: `hr:payroll:view|generate|approve|pay`, `hr:settings:manage`, `hr:concepts:manage`.

## 6. UI/UX

| Pantalla                    | Contenido                                                                        |
| --------------------------- | -------------------------------------------------------------------------------- |
| `settings/payroll-settings` | Parámetros con vigencia e historial; bloqueo si hay run abierto                  |
| `settings/payroll-concepts` | Catálogo con tipo/fórmula y validación de expresión                              |
| `hr/payroll/[id]`           | Cabecera, totales, tabla por empleado expandible a líneas, acciones según estado |
| `hr/employees/[id]`         | Datos, contrato, salario, cuenta bancaria, histórico de recibos, liquidar        |
| `hr/payroll`                | Botón "Generar período", filtros por estado y sucursal                           |

## 7. Reglas de negocio (LOTTT — validar con `09-HR-NOMINA-VENEZUELA.md`)

1. Salario integral = salario normal + alícuota de utilidades + alícuota de bono vacacional.
2. Prestaciones: garantía trimestral + días adicionales; se acumulan por antigüedad.
3. Utilidades: mínimo legal y tope según parámetros; base = salario normal del período.
4. Vacaciones y bono vacacional: días base + 1 por año de servicio, con topes configurables.
5. Cestaticket **no** es salario: no afecta integral ni prestaciones.
6. Aportes patronales (IVSS, paro forzoso, FAOV) se calculan y registran por separado del neto.
7. Un run `PAID` es inmutable; corrección = `VOID` + nuevo run (auditado).
8. Nómina y pago se generan por sucursal (`S-00`).

## 8. Criterios de aceptación (Gherkin)

```gherkin
Escenario: parámetros congelados por período
  Dado un run CALCULATED con salario mínimo X
  Cuando se actualiza el parámetro a Y
  Entonces el run conserva X y un nuevo run usa Y

Escenario: pago idempotente
  Cuando POST /v1/hr/payroll/:id/pay dos veces
  Entonces la segunda responde 409 y existe un solo pago asociado

Escenario: liquidación con causa injustificada
  Dado un empleado con 3 años y 4 meses
  Cuando se liquida por despido injustificado
  Entonces el total incluye prestaciones, fracciones y la indemnización correspondiente
  Y el detalle por concepto es visible
```

## 9. Plan de pruebas

| Tipo        | Caso                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Unitario    | Cálculo de integral, prestaciones, utilidades, vacaciones y liquidación con casos de borde (0 años, 1 día) |
| Integración | Generar → process → approve → pay; verificar asiento contable y pago en tesorería                          |
| E2E         | Analista configura parámetros, genera y ve el recibo                                                       |
| Regresión   | `payroll_settings` compartidos no contaminan runs previos                                                  |

## 10. Riesgos

| Riesgo                             | Mitigación                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Fórmulas legales mal interpretadas | Tabla de casos de prueba revisada contra el documento 09 y validada por negocio |
| Redondeo bancario                  | Política única en `payroll_settings.roundingMode`, aplicada en un solo helper   |
| Runs largos                        | Cálculo por lotes con transacción por empleado y progreso en UI                 |
