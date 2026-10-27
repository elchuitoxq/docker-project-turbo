# 09 — Nómina Venezuela (LOTTT) — reglas del ERP

> **Estado:** motor, prestaciones, liquidación, pago y UI **implementados** (T-02-01 … T-02-10);
> las 25 reglas tienen criterio de aceptación y §14.1 dice qué prueba sostiene cada una. Sigue
> **pendiente la revisión** por contador laboral / abogado laboral de los valores marcados con ⚠️,
> que dependen de decretos y **deben validarse su vigencia** en la fecha de entrada en producción.
> **Fecha:** 2026-10-27 · **Tarea:** T-02-00 · **Spec:** [`S-02`](./sdd/specs/S-02-nomina-ve.md)
>
> **Fuentes:** [`audit-report/09-HR-NOMINA-VENEZUELA.md`](../audit-report/09-HR-NOMINA-VENEZUELA.md)
> (inventario del esquema actual) y [`packages/database/src/schema.ts`](../packages/database/src/schema.ts)
> (fuente de verdad). Este documento no repite el inventario: define **cómo se calcula** sobre él.

## 1. Objetivo

Definir, con el nivel de detalle de un sistema de planilla empresarial, **cómo calcula este ERP la
nómina venezolana**: qué conceptos existen, sobre qué bases se calculan, en qué orden se procesan,
cómo se congelan los parámetros y cómo se contabiliza.

El documento cumple dos funciones:

1. **Fuente normativa**: qué exige la LOTTT y qué queda como parámetro configurable.
2. **Fuente funcional**: qué tiene que implementar el ERP para cumplirlo, con reglas verificables.

## 2. Alcance

**Incluye:** salario normal e integral, asignaciones, deducciones, aportes patronales, cestaticket,
vacaciones y bono vacacional, utilidades, prestaciones sociales (garantía y retroactivo),
liquidación por egreso, retención de ISLR, y las salidas (recibo, archivo bancario, reportes).

**No incluye:** nómina de expatriados, planes de pensiones distintos al IVSS, ni cálculo masivo
anual de utilidades como proceso batch (queda para una iteración posterior).

## 3. Principios de diseño (modelo SAP aplicado)

Se adopta la arquitectura de un motor de nómina tipo SAP HCM, porque resuelve tres problemas que un
cálculo ad-hoc no resuelve: **parametrización con vigencia**, **orden de procesamiento explícito** y
**trazabilidad por concepto**.

| Concepto SAP HCM                | Equivalente en el ERP                                                   |
| ------------------------------- | ----------------------------------------------------------------------- |
| Wage type (`Lohnart`, `/1xx`)   | `payroll_concept_types` + `payroll_item_lines.conceptCode`              |
| Calculation basis / cumulación  | Bases de cálculo (§7), guardadas por línea en `payroll_item_lines.base` |
| Constant (`T511K`)              | `payroll_settings` (`key`, `value`, `effectiveFrom`)                    |
| Processing schema (`R000`)      | Pipeline de etapas del motor (§6)                                       |
| Personnel calculation rule      | `payroll_concept_types.expression` (fórmula declarativa)                |
| Payroll control record (`PA03`) | `payroll_runs.status` (DRAFT → CALCULATED → APPROVED → PAID → VOID)     |
| Retrocalculation                | Recálculo con **snapshot** de parámetros (`payroll_period_settings`)    |
| Posting to FI                   | Asiento contable por concepto vía `accounting_maps`                     |
| Cost center / personnel area    | `branchId` (sucursal)                                                   |
| Infotype 0008 / 0014 / 0009     | `employees`, `employee_salary_history`, `employee_bank_accounts`        |

**Regla de oro (SAP-style):** un `payroll_run` **congela** sus parámetros. Cambiar `payroll_settings`
después **no** altera períodos cerrados. Sin esto, cualquier recálculo histórico produce diferencias
imposibles de explicar.

## 4. Marco legal mínimo

| Materia                         | Norma                                              | Qué obliga                                                                       |
| ------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Salario normal                  | LOTTT Art. 104                                     | Remuneración por jornada ordinaria; incluye recargos y percepciones habituales   |
| Salario integral                | LOTTT Art. 105                                     | Salario normal + alícuota de utilidades + alícuota de bono vacacional            |
| Utilidades                      | LOTTT Art. 131                                     | Mínimo 30 días de salario y máximo legal según tamaño de la empresa              |
| Prestaciones sociales           | LOTTT Art. 142                                     | Dos modalidades de cálculo (garantía trimestral y retroactivo); se paga la mayor |
| Depósito trimestral             | LOTTT Art. 142 literal “a”                         | 15 días por trimestre sobre salario integral, depositados trimestralmente        |
| Días adicionales                | LOTTT Art. 142 literal “b”                         | 2 días por año de servicio acumulativos hasta un tope                            |
| Liquidación al egreso           | LOTTT Art. 143 y 92                                | Prestaciones + indemnización según la causa del egreso                           |
| Vacaciones                      | LOTTT Art. 190                                     | 15 días hábiles + 1 día por año de servicio hasta un tope adicional              |
| Bono vacacional                 | LOTTT Art. 192                                     | 7 días + 1 por año de servicio hasta un tope                                     |
| Cestaticket                     | Ley de Alimentación                                | Beneficio no salarial, con monto por decreto ⚠️                                  |
| Seguro social (IVSS)            | Ley del Seguro Social                              | Aporte del trabajador y del patrono sobre salario con tope ⚠️                    |
| Paro forzoso                    | Ley del Régimen Prestacional de Empleo             | Aporte del trabajador y del patrono ⚠️                                           |
| Vivienda (FAOV)                 | Ley del Régimen Prestacional de Vivienda y Hábitat | Aporte del trabajador y del patrono ⚠️                                           |
| Retención de ISLR sobre sueldos | LISLR Art. 78 y tarifas                            | Retención progresiva anual sobre enriquecimiento                                 |

⚠️ **Todos los porcentajes, topes y montos mínimos son parámetros, no constantes de código.** Se
cargan con fecha de vigencia y quedan auditados (ver §10).

## 5. Catálogo de conceptos (wage types)

`payroll_concept_types.category` admite cuatro naturalezas:

| Categoría               | Significado                                     | Afecta el neto |
| ----------------------- | ----------------------------------------------- | -------------- |
| `ASSIGNMENT`            | Asignación (suma al trabajador)                 | Sí             |
| `DEDUCTION`             | Deducción (resta al trabajador)                 | Sí             |
| `EMPLOYER_CONTRIBUTION` | Aporte patronal (costo, no toca el neto)        | No             |
| `INFORMATIVE`           | Sólo informativo (bases, alícuotas, acumulados) | No             |

### 5.1 Conceptos del sistema

| Código              | Nombre                      | Categoría                | Fórmula / base                             | Legal     | Código actual |
| ------------------- | --------------------------- | ------------------------ | ------------------------------------------ | --------- | ------------- |
| `SALARY`            | Sueldo básico del período   | `ASSIGNMENT`             | `base_salary` × (días del período / 30)    | Art. 104  | `SALARY`      |
| `PRIMA`             | Primas habituales           | `ASSIGNMENT`             | Monto o % del sueldo básico                | Art. 104  | —             |
| `OVERTIME`          | Horas extraordinarias       | `ASSIGNMENT`             | Horas × valor hora × recargo               | Art. 118  | —             |
| `CESTATICKET`       | Cestaticket                 | `ASSIGNMENT` no salarial | Parámetro mensual × (días / 30)            | Ley Alim. | `CESTATICKET` |
| `VACATION_PAY`      | Pago de vacaciones          | `ASSIGNMENT`             | Días de vacaciones × salario diario normal | Art. 190  | —             |
| `VACATION_BONUS`    | Bono vacacional             | `ASSIGNMENT`             | Días de bono × salario diario normal       | Art. 192  | —             |
| `PROFIT_SHARING`    | Utilidades del ejercicio    | `ASSIGNMENT`             | Días a pagar × salario diario promedio     | Art. 131  | —             |
| `RETRO`             | Diferencia retroactiva      | `ASSIGNMENT`             | Diferencia de períodos anteriores (§11)    | —         | —             |
| `SSO_EMP`           | Seguro social trabajador    | `DEDUCTION`              | Base IVSS × alícuota trabajador            | LSS       | `SSO_EMP`     |
| `PIE_EMP`           | Paro forzoso trabajador     | `DEDUCTION`              | Base paro × alícuota trabajador            | LRPE      | `PIE_EMP`     |
| `FAOV_EMP`          | FAOV trabajador             | `DEDUCTION`              | Base FAOV × alícuota trabajador            | LRPVH     | `FAOV_EMP`    |
| `ISLR`              | Retención de ISLR           | `DEDUCTION`              | Base ISLR mensual según tarifa progresiva  | LISLR 78  | —             |
| `SSO_PAT`           | Seguro social patronal      | `EMPLOYER_CONTRIBUTION`  | Base IVSS × alícuota patronal              | LSS       | —             |
| `PIE_PAT`           | Paro forzoso patronal       | `EMPLOYER_CONTRIBUTION`  | Base paro × alícuota patronal              | LRPE      | —             |
| `FAOV_PAT`          | FAOV patronal               | `EMPLOYER_CONTRIBUTION`  | Base FAOV × alícuota patronal              | LRPVH     | —             |
| `BENEFIT_GUARANTEE` | Garantía trimestral         | `INFORMATIVE` + depósito | 15 días × salario integral diario          | Art. 142  | —             |
| `UTIL_ALLOWANCE`    | Alícuota de utilidades      | `INFORMATIVE`            | (Días utilidades × salario diario) / 360   | Art. 105  | —             |
| `BONUS_ALLOWANCE`   | Alícuota de bono vacacional | `INFORMATIVE`            | (Días bono × salario diario) / 360         | Art. 105  | —             |

Cada concepto guarda `code`, `name`, `category`, `expression` (fórmula declarativa) y
`affectsIntegralSalary` (si entra o no en el salario integral).

**Compatibilidad de códigos.** Los cinco códigos de la columna “Código actual” ya existen en
`payroll_item_lines` de runs históricos. Se conservan literalmente para no invalidar datos; los
nuevos se agregan al seed. La migración de T-02-02 sólo tiene que **normalizar la categoría**:
`INCOME` → `ASSIGNMENT` (backfill) y añadir los valores `EMPLOYER_CONTRIBUTION` e `INFORMATIVE`.

### 5.2 Estado real del cálculo hoy (lo que hay que reemplazar)

Auditado en [`hr.service.ts`](../apps/backend/src/modules/hr/services/hr.service.ts)
(`calculatePayrollItem`). El cálculo actual **no** es una versión reducida de este documento: es otro
cálculo. Se deja constancia antes de tocar nada, porque cada punto es una decisión que hay que tomar
conscientemente al escribir el motor (T-02-03).

| #   | Defecto actual                                                                               | Por qué importa                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Las alícuotas son **constantes en el código** (`SSO_EMP_RATE = 0.04`, …)                     | **Resuelto en T-02-03**: las constantes se eliminaron y el motor resuelve los parámetros del snapshot del run. Editar el parámetro ahora sí cambia el cálculo. |
| D2  | `payroll_settings.key` es **único global** y el seed usa `onConflictDoUpdate`                | **Resuelto en T-02-01**: la clave ahora es única por empresa, sucursal y vigencia (`effectiveFrom`)                                                            |
| D3  | Los porcentajes se guardan como `4` con `type = 'PERCENTAGE'`, mientras el código usa `0.04` | **Resuelto en T-02-01**: se fija la convención (**porcentaje entero**, `4 = 4 %`) y se valida al guardar (`0 < value <= 100`)                                  |
| D4  | `CESTATICKET_USD = 40.0` se **suma** al neto de un salario que puede estar en **VES**        | **Resuelto en T-02-03**: el parámetro es `MONEY_USD` y el motor lo convierte a la moneda del run con la tasa del período (regla M4)                            |
| D5  | `bonuses = CESTATICKET_USD`                                                                  | **Resuelto en T-02-03**: el cestaticket es `isSalarial = false` y se excluye de `SALARY_NORMAL` (RN-02)                                                        |
| D6  | `const integralSalary = baseSalary * 1.17` **no se usa**                                     | **Resuelto en T-02-03**: el integral sale de las alícuotas del catálogo (RN-03…RN-05), sin factores mágicos                                                    |
| D7  | `SSO_PAT_RATE`, `FAOV_PAT_RATE`, `PIE_PAT_RATE` están declaradas pero **nunca se aplican**   | **Resuelto en T-02-03**: los aportes patronales se calculan y se registran con categoría `EMPLOYER_CONTRIBUTION`                                               |
| D8  | `baseAmount = emp.baseSalary` sin prorrateo por días del período                             | **Resuelto en T-02-03**: el período se prorratea por días, con tope de un mes (RN-01)                                                                          |
| D9  | No hay ISLR, ni utilidades, ni prestaciones, ni vacaciones en el cálculo                     | **Parcial en T-02-03**: ya se calculan la garantía trimestral y las alícuotas; utilidades, vacaciones e ISLR llegan en T-02-04                                 |
| D10 | `category` de las líneas es `INCOME` / `DEDUCTION`                                           | **Resuelto en T-02-03**: las líneas usan `ASSIGNMENT` / `DEDUCTION` / `EMPLOYER_CONTRIBUTION` / `INFORMATIVE`                                                  |

> **Consecuencia para el plan:** T-02-03 **sustituyó** `calculatePayrollItem` por el pipeline de §6.
> Del cálculo anterior no queda nada salvo los códigos de concepto, que se conservaron para no
> invalidar los runs históricos (`SALARY`, `CESTATICKET`, `SSO_EMP`, `FAOV_EMP`, `PIE_EMP`).

## 6. Esquema de procesamiento (pipeline del motor)

Cada etapa es una función pura sobre el estado del período, y su resultado es auditable. Se ejecutan
**en este orden**; invertir el orden cambia el resultado.

| #   | Etapa                    | Qué hace                                                      | Falla si                     |
| --- | ------------------------ | ------------------------------------------------------------- | ---------------------------- |
| 1   | `cargarContexto`         | Empleados activos del período, contrato, frecuencia, sucursal | No hay contrato vigente      |
| 2   | `snapshotParametros`     | Copia `payroll_settings` vigentes a `payroll_period_settings` | Falta un parámetro requerido |
| 3   | `salarioBase`            | Sueldo del período prorrateado por días                       | Salario ≤ 0                  |
| 4   | `asignacionesHabituales` | Primas, recargos y horas extra                                | …                            |
| 5   | `salarioNormal`          | Base normal = sueldo + asignaciones habituales                | …                            |
| 6   | `alicuotas`              | Alícuota de utilidades y de bono vacacional                   | Faltan días legales          |
| 7   | `salarioIntegral`        | Base integral = normal + alícuotas                            | …                            |
| 8   | `basesLegales`           | Bases de IVSS, paro forzoso, FAOV e ISLR con sus topes        | …                            |
| 9   | `deduccionesLegales`     | IVSS, paro forzoso, FAOV, ISLR                                | …                            |
| 10  | `aportesPatronales`      | IVSS, paro forzoso y FAOV patronales                          | …                            |
| 11  | `neto`                   | Asignaciones − deducciones                                    | Neto negativo (bloqueante)   |
| 12  | `prestaciones`           | Garantía trimestral y días adicionales acumulados             | …                            |
| 13  | `contabilizar`           | Asiento por concepto según `accounting_maps`                  | Falta el mapeo del concepto  |

## 7. Bases de cálculo (cumulaciones)

Igual que las cumulaciones de SAP, cada base se calcula **una vez** y la consumen varios conceptos.
Así un cambio en la definición de “salario normal” se hace en un solo lugar.

| Base               | Composición                                                       | Se usa en                               |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------- |
| `SALARIO_NORMAL`   | Sueldo del período + primas + horas extra + cestaticket **no**    | Vacaciones, bono vacacional, utilidades |
| `SALARIO_INTEGRAL` | `SALARIO_NORMAL` + alícuota utilidades + alícuota bono vacacional | Prestaciones e indemnizaciones          |
| `BASE_IVSS`        | `SALARIO_NORMAL` acotado al tope de IVSS                          | IVSS trabajador y patronal              |
| `BASE_PARO`        | `SALARIO_NORMAL` acotado al tope de paro forzoso                  | Paro forzoso                            |
| `BASE_FAOV`        | `SALARIO_NORMAL` acotado al tope de FAOV                          | FAOV                                    |
| `BASE_ISLR`        | Remuneración acumulada del año menos desgravámenes                | Retención de ISLR                       |

> **Decisión registrada:** el **cestaticket no forma parte del salario** (Ley de Alimentación). No
> entra en `SALARIO_NORMAL`, por lo tanto no afecta integral ni prestaciones. Es el error más común
> en sistemas de nómina venezolanos.

## 8. Reglas de negocio

Cada regla tiene un criterio de aceptación verificable. La numeración (`RN-xx`) se usa en los tests.

### 8.1 Salario y bases

- **RN-01** — El sueldo del período se prorratea por días: `sueldo × (días del período / 30)`.
  _Aceptación:_ período completo de 30 días paga el sueldo íntegro; 15 días paga la mitad.
- **RN-02** — `SALARIO_NORMAL` = sueldo + primas habituales + horas extra. **Excluye** cestaticket,
  viáticos y reembolsos. _Aceptación:_ agregar cestaticket no altera `SALARIO_NORMAL`.
- **RN-03** — `ALICUOTA_UTIL` = (días de utilidades × salario diario) / 360.
  _Aceptación:_ 30 días de utilidades y salario diario 333,33 dan 27,78 por día.
- **RN-04** — `ALICUOTA_BONO` = (días de bono vacacional × salario diario) / 360.
  _Aceptación:_ 7 días de bono y salario diario 333,33 dan 6,48 por día.
- **RN-05** — `SALARIO_INTEGRAL` = normal + alícuota utilidades + alícuota bono.
  _Aceptación:_ 333,33 + 27,78 + 6,48 = 367,59.
- **RN-06** — Las bases legales aplican tope **antes** de la alícuota, no después.
  _Aceptación:_ un salario por encima del tope produce la misma deducción que el tope.

### 8.2 Deducciones y aportes

- **RN-07** — IVSS, paro forzoso y FAOV se calculan sobre bases distintas y con alícuotas
  parametrizadas. _Aceptación:_ cambiar la alícuota patronal no altera la deducción del trabajador.
- **RN-08** — Los aportes patronales **no** reducen el neto; se registran como costo en líneas
  `EMPLOYER_CONTRIBUTION`. _Aceptación:_ el neto es idéntico con y sin aportes patronales.
- **RN-09** — La retención de ISLR se calcula sobre la remuneración **acumulada del año** menos los
  desgravámenes, aplicando la tarifa progresiva. _Aceptación:_ dos pagos iguales en meses distintos
  no producen la misma retención si cambia el acumulado.
- **RN-10** — Si el neto resulta negativo, el run **falla** y no se persiste.
  _Aceptación:_ deducciones mayores que asignaciones devuelven error de validación.

### 8.3 Prestaciones sociales

- **RN-11** — Se calculan **dos** modalidades y se registra la mayor: garantía trimestral
  (15 días × salario integral por trimestre) y retroactivo (días por año acumulados × último salario
  integral). _Aceptación:_ el monto informado es `max(garantía, retroactivo)`.
- **RN-12** — Los días adicionales (2 por año desde el segundo año) se acumulan hasta el tope
  configurado. _Aceptación:_ con tope 30, el año 5 no supera 30 días adicionales.
- **RN-13** — La garantía se **deposita** trimestralmente y genera un registro inmutable por
  trimestre en `employee_benefits`. _Aceptación:_ recalcular el trimestre no duplica el depósito.

### 8.4 Vacaciones, utilidades y cestaticket

- **RN-14** — Vacaciones: 15 días hábiles + 1 por año de servicio, con tope adicional configurable.
  _Aceptación:_ 3 años de servicio y tope 15 dan 17 días.
- **RN-15** — Bono vacacional: 7 días + 1 por año, con tope configurable.
  _Aceptación:_ 3 años y tope 21 dan 9 días.
- **RN-16** — Utilidades: mínimo 30 días y máximo legal según el tamaño de la empresa (parámetro).
  _Aceptación:_ el monto nunca es menor a 30 días de salario promedio.
- **RN-17** — El cestaticket se paga por días efectivos de asistencia y **no** es salario.
  _Aceptación:_ 15 días de falta reducen el cestaticket y no alteran `SALARIO_NORMAL`.

### 8.5 Egreso y liquidación

- **RN-18** — La liquidación incluye prestaciones, vacaciones pendientes, bono vacacional
  proporcional, utilidades proporcionales y, según la causa, la indemnización del Art. 92.
  _Aceptación:_ un egreso por renuncia no incluye indemnización; uno injustificado sí.
- **RN-19** — La liquidación es un documento **inmutable** con su propio estado
  (`DRAFT` → `CALCULATED` → `PAID`) en `employee_settlements`.
- **RN-20** — Un egreso no puede liquidarse dos veces: segundo intento devuelve `409`.

### 8.6 Integridad del proceso

- **RN-21** — Un run `PAID` es inmutable. Corregir exige `VOID` + run nuevo, auditado.
- **RN-22** — Un run congela sus parámetros: cambiar `payroll_settings` después no altera runs
  anteriores. _Aceptación:_ recalcular un run cerrado produce el mismo total.
- **RN-23** — La nómina y el pago se generan **por sucursal** (regla R5 de `S-00`).
- **RN-24** — El pago de nómina crea **un solo** `payment` por run (idempotente por `payrollRunId`).
  _Aceptación:_ invocar el pago dos veces deja un único movimiento de tesorería.
- **RN-25** — Cada concepto con monto debe tener mapeo contable; si falta, el run falla al
  contabilizar en lugar de generar un asiento incompleto.

## 9. Casos dorados (base de los tests)

Salario mensual **Bs. 10.000,00**, 30 días, sin primas ni horas extra, 1 año de servicio.

| Cálculo                    | Operación             | Resultado        |
| -------------------------- | --------------------- | ---------------- |
| Salario diario             | 10.000 / 30           | **333,33**       |
| Utilidades (30 días)       | 30 × 333,33           | **10.000,00**    |
| Bono vacacional (7 días)   | 7 × 333,33            | **2.333,33**     |
| Alícuota utilidades        | 10.000 / 360          | **27,78**        |
| Alícuota bono vacacional   | 2.333,33 / 360        | **6,48**         |
| Salario integral diario    | 333,33 + 27,78 + 6,48 | **367,59**       |
| Garantía trimestral        | 15 × 367,592593       | **5.513,89**     |
| Cestaticket (mes completo) | parámetro             | ⚠️ según decreto |

> **Dos precisiones que la implementación dejó claras (T-02-03):**
>
> 1. Las alícuotas de utilidades y bono vacacional, y por lo tanto el salario integral, se expresan en
>    **valor diario** (LOTTT Art. 105). El integral mensual sería `SALARY_NORMAL + 30 × alícuotas`.
> 2. El motor **no redondea resultados intermedios** (regla M7): la garantía se calcula sobre
>    367,592593 y da 5.513,89; redondear el integral a 367,59 antes de multiplicar daría 5.513,85.
>    Los importes por concepto sí se redondean a 2 decimales al persistirse.

**Caso de vacaciones con 3 años de servicio:** 15 + 2 = **17 días** de vacaciones y 7 + 2 = **9 días**
de bono, porque el día adicional empieza a contar desde el segundo año (Art. 190: los 15 días se
causan al cumplir el primer año y luego se suma uno por año).

**Caso de prestaciones con 5 años:** garantía acumulada de 20 trimestres × 15 días + 8 días
adicionales = 308 días; el retroactivo se calcula con los días por año del Art. 142 y se informa el
mayor (RN-11). Los días por año del retroactivo son parámetro (`DIAS_RETROACTIVO_ANIO`, ⚠️).

## 10. Parámetros (`payroll_settings`)

Cada parámetro lleva `key`, `label`, `value`, `type`, `effectiveFrom` y `branchId` opcional.

**Los siete primeros `key` ya existen en el seed** (`seed-faker.ts`), así que se conservan tal cual.
Las claves legales nuevas se agregan con el mismo formato.

| Clave                              | Descripción                              | Tipo        | Vigencia       | Ya existe |
| ---------------------------------- | ---------------------------------------- | ----------- | -------------- | --------- |
| `CESTATICKET_USD`                  | Monto mensual del beneficio              | `MONEY_USD` | ⚠️ por decreto | Sí        |
| `SSO_EMP`                          | % seguro social trabajador               | `PERCENT`   | ⚠️             | Sí        |
| `SSO_PAT`                          | % seguro social patronal                 | `PERCENT`   | ⚠️             | Sí        |
| `FAOV_EMP`                         | % FAOV trabajador                        | `PERCENT`   | ⚠️             | Sí        |
| `FAOV_PAT`                         | % FAOV patronal                          | `PERCENT`   | ⚠️             | Sí        |
| `PIE_EMP`                          | % paro forzoso trabajador                | `PERCENT`   | ⚠️             | Sí        |
| `PIE_PAT`                          | % paro forzoso patronal                  | `PERCENT`   | ⚠️             | Sí        |
| `SALARIO_MINIMO`                   | Salario mínimo mensual                   | `MONEY`     | ⚠️ por decreto | No        |
| `UNIDAD_TRIBUTARIA`                | Valor de la unidad tributaria            | `MONEY`     | ⚠️ anual       | No        |
| `DIAS_UTILIDADES`                  | Días mínimos de utilidades               | `NUMBER`    | Legal          | No        |
| `TOPE_UTILIDADES_MESES`            | Tope en meses según tamaño de empresa    | `NUMBER`    | Legal          | No        |
| `DIAS_VACACIONES_BASE`             | 15                                       | `NUMBER`    | Art. 190       | No        |
| `TOPE_DIAS_VACACIONES_EXTRA`       | Tope de días adicionales                 | `NUMBER`    | Legal          | No        |
| `DIAS_BONO_VACACIONAL`             | 7                                        | `NUMBER`    | Art. 192       | No        |
| `TOPE_DIAS_BONO_EXTRA`             | Tope de días adicionales del bono        | `NUMBER`    | Legal          | No        |
| `DIAS_GARANTIA_TRIMESTRE`          | 15                                       | `NUMBER`    | Art. 142       | No        |
| `DIAS_ADICIONALES_ANIO`            | 2                                        | `NUMBER`    | Art. 142       | No        |
| `TOPE_DIAS_ADICIONALES`            | Tope acumulable                          | `NUMBER`    | Legal          | No        |
| `DIAS_RETROACTIVO_ANIO`            | Días por año de la modalidad retroactiva | `NUMBER`    | ⚠️             | No        |
| `INDEMNIZACION_DIAS_HASTA_UN_ANIO` | Días si la antigüedad no excede un año   | `NUMBER`    | ⚠️             | No        |
| `INDEMNIZACION_DIAS_BASE`          | Días por año hasta diez años             | `NUMBER`    | ⚠️             | No        |
| `INDEMNIZACION_TOPE_1`             | Tope de días hasta diez años             | `NUMBER`    | ⚠️             | No        |
| `INDEMNIZACION_DIAS_MAYOR_10`      | Días por año después de diez años        | `NUMBER`    | ⚠️             | No        |
| `INDEMNIZACION_TOPE_2`             | Tope de días después de diez años        | `NUMBER`    | ⚠️             | No        |
| `TOPE_SSO`                         | Salario máximo cotizable del SSO         | `MONEY`     | ⚠️             | No        |
| `POLITICA_REDONDEO`                | `HALF_UP` por defecto                    | `TEXT`      | Decisión D-01  | No        |

> **Convención de escala (resuelve D3):** `type = 'PERCENT'` guarda **el porcentaje como número
> entero**, es decir `4` significa 4 %. El motor divide entre 100 al aplicar. La convención debe
> validarse al guardar (`0 < value <= 100`) para que un `0.04` cargado por error no pase inadvertido.

> **Parámetros en divisa (resuelve D4/H-62):** un parámetro con `type = 'MONEY_XXX'` está expresado en
> esa moneda. El motor lo convierte a la moneda del run con la tasa del período **antes** de usarlo; si
> el valor es 0 no se pide tasa. Es lo que impide que un cestaticket en dólares se sume a un sueldo en
> bolívares sin convertir.

> **Inmutabilidad:** al iniciar un run, todos los valores vigentes se copian a
> `payroll_period_settings`. Cambiar el parámetro mañana **no** reescribe la nómina de ayer.

> **Deuda cerrada en T-02-01 (2026-10-27):** `key` ya no es único global; la unicidad es
> `(companyId, key, effectiveFrom)` para los valores de empresa y `(companyId, branchId, key,
effectiveFrom)` para los de sucursal (índices parciales). El seed resuelve la existencia por
> vigencia en lugar de `onConflictDoUpdate` sobre la clave.

## 11. Retroactividad y recálculo

1. Un aumento de sueldo con fecha pasada genera una **diferencia retroactiva** por los períodos
   afectados (patrón `P0015` de SAP).
2. La diferencia se paga como concepto `RETROACTIVO` (`ASSIGNMENT`) en el run corriente, con
   referencias al período original.
3. La retroactividad **no** recalcula runs cerrados: se calcula la diferencia con el snapshot del
   período original y se paga aparte.
4. Si el período está `PAID`, la corrección exige `VOID` del run y uno nuevo (RN-21).

## 12. Contabilización

Cada concepto declara su cuenta mediante `accounting_maps` (clave `module = PAYROLL`,
`transactionType = <código de concepto>`). El asiento del run:

| Lado    | Cuenta                               | Importe                       |
| ------- | ------------------------------------ | ----------------------------- |
| Débito  | Gasto de sueldos y salarios          | Total de asignaciones         |
| Débito  | Gasto de aportes patronales          | Total `EMPLOYER_CONTRIBUTION` |
| Crédito | Sueldos por pagar                    | Neto a pagar                  |
| Crédito | IVSS / Paro forzoso / FAOV por pagar | Deducciones y aportes legales |
| Crédito | ISLR por pagar                       | Retención                     |

**RN-25 obliga** a fallar si falta el mapeo de un concepto con monto: es preferible un run detenido
a un libro descuadrado.

## 13. Salidas

| Salida            | Contenido                                                                      |
| ----------------- | ------------------------------------------------------------------------------ |
| Recibo de pago    | Desglose por concepto (código, nombre, base, tasa, monto), neto y acumulados   |
| Archivo bancario  | Cuenta del empleado (`employee_bank_accounts`), monto neto, referencia del run |
| Reporte IVSS      | Base y aportes por trabajador                                                  |
| Reporte FAOV/paro | Base y aportes por trabajador                                                  |
| Reporte ISLR      | Base acumulada, desgravámenes y retención                                      |
| Asiento contable  | §12                                                                            |

## 14. Trazabilidad a la implementación

| Regla / pieza                        | Dónde se implementa                                                                                           | Tarea         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------- |
| Parámetros con vigencia              | `payroll_settings` (`effectiveFrom`, `companyId`) + `payroll_period_settings`                                 | ✅ T-02-01    |
| Catálogo de conceptos                | `payroll_concept_types` (`code`, `kind`, `expression`) + CRUD `/hr/concept-types`                             | ✅ T-02-02    |
| Resolución de vigencia y validación  | `modules/hr/payroll/settings-resolver.ts`, `concept-expression.ts`                                            | ✅ T-02-01/02 |
| Pipeline de cálculo por concepto     | `modules/hr/payroll/payroll.calculator.ts` + `expression-evaluator.ts`                                        | ✅ T-02-03    |
| Prestaciones, utilidades, vacaciones | `modules/hr/payroll/labor-benefits.ts` + `employee_benefits`, `employee_profit_sharing`, `employee_vacations` | ✅ T-02-04    |
| Liquidación                          | `employee_settlements` + `POST /hr/employees/:id/settle`                                                      | ✅ T-02-05    |
| Pago idempotente                     | `POST /hr/payroll/:id/pay` + `payments.payrollRunId` (RN-24)                                                  | ✅ T-02-06    |
| UI parámetros y conceptos            | `settings/payroll-settings`, `settings/payroll-concepts`                                                      | ✅ T-02-07/08 |
| UI ficha y recibo                    | `hr/employees/[id]`, `hr/payroll/[id]`                                                                        | ✅ T-02-09    |
| Casos dorados y pruebas              | Este documento §9 y §14.1                                                                                     | ✅ T-02-10    |

### 14.1 Cobertura de reglas (T-02-10)

Verificado contra la suite real (`852` pruebas de backend al cierre de la épica). Cada regla apunta a
la prueba que la sostiene, no a la intención de implementarla.

| Regla | Criterio verificado                                                        | Prueba                                                                          |
| ----- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| RN-01 | Prórrateo por días del período                                             | `payroll.calculator.test.ts` · "prorratea por días del período"                 |
| RN-02 | El cestaticket no altera `SALARIO_NORMAL`                                  | `payroll.calculator.test.ts` · "el cestaticket no entra en el salario normal"   |
| RN-03 | Alícuota diaria de utilidades                                              | `payroll.calculator.test.ts` · "calcula las alícuotas diarias"                  |
| RN-04 | Alícuota diaria de bono vacacional                                         | `payroll.calculator.test.ts` · "calcula las alícuotas diarias"                  |
| RN-05 | `SALARY_INTEGRAL` = normal + alícuotas = 367,59                            | `payroll.calculator.test.ts` · "calcula el salario integral diario"             |
| RN-06 | El tope se aplica antes de la alícuota                                     | `payroll.calculator.test.ts` · "aplica el tope de la base antes de la alícuota" |
| RN-07 | Alícuotas parametrizadas por base                                          | `payroll.calculator.test.ts` · "aplica las deducciones legales"                 |
| RN-08 | El costo patronal no reduce el neto                                        | `payroll.calculator.test.ts` · "registra el costo patronal sin restarlo"        |
| RN-10 | Neto negativo falla y no se persiste                                       | `payroll.calculator.test.ts` · "falla si el neto resulta negativo"              |
| RN-11 | Se paga la modalidad mayor (garantía vs retroactivo)                       | `hr-benefits.test.ts` · "toma el salario integral del motor de nómina"          |
| RN-12 | Días adicionales con tope                                                  | `labor-benefits.test.ts` · prestaciones (RN-11, RN-12, RN-13)                   |
| RN-13 | El trimestre no se deposita dos veces                                      | `hr-benefits.test.ts` · "no deja depositar dos veces el mismo trimestre"        |
| RN-14 | 3 años y tope 15 → 17 días                                                 | `hr-benefits.test.ts` · "calcula los días por antigüedad"                       |
| RN-15 | 3 años y tope 21 → 9 días de bono                                          | `hr-benefits.test.ts` · "calcula los días por antigüedad"                       |
| RN-16 | Utilidades mínimo 30 días con prorrateo por meses                          | `hr-benefits.test.ts` · bloque "Utilidades"                                     |
| RN-17 | El cestaticket no es salario                                               | `payroll.calculator.test.ts` · "el cestaticket no entra en el salario normal"   |
| RN-18 | La renuncia no indemniza; el despido injustificado sí                      | `hr-settlement.test.ts` · dos pruebas del bloque "Liquidación de egreso"        |
| RN-19 | La liquidación es un documento propio                                      | `hr-settlement.test.ts` · "marca al empleado como egresado con la causa"        |
| RN-20 | Segundo intento de liquidar devuelve conflicto                             | `hr-settlement.test.ts` · "no liquida dos veces al mismo empleado"              |
| RN-22 | El run congela sus parámetros                                              | `payroll-engine.test.ts` · "congela los parámetros del run"                     |
| RN-23 | Precedencia sucursal > empresa y aislamiento entre sucursales              | `payroll-rules.test.ts` · "da precedencia al valor de la sucursal"              |
| RN-24 | Dos llamadas al pago dejan un único movimiento                             | `payroll-payment.test.ts` · "dos llamadas producen un solo movimiento"          |
| H-70  | Sueldo en divisa: vacaciones y prestaciones resuelven la tasa del contrato | `hr-benefits.test.ts` · bloque "Sueldo en divisa (H-70)"                        |

**Reglas sin cobertura todavía**

| Regla | Por qué                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------- |
| RN-09 | ISLR: falta la tabla progresiva y la definición de desgravámenes (decisión P-28). El concepto existe y paga 0 |
| RN-21 | `VOID` de un run pagado: el estado está previsto en el enum pero la reversión no se implementó                |
| RN-25 | Mapeo contable por concepto: depende de `accounting_maps` (S-04)                                              |

> **Hueco detectado al validar la UI (H-72):** RN-14 y RN-15 se cumplen para antigüedad ≥ 1 año, pero
> con `years = 0` acreditan 15 + 7 días completos. La liquidación en vivo de un empleado con un día de
> servicio pagó **121.666,67**, casi todo bono vacacional. No se cambió la fórmula porque el criterio
> proporcional (Art. 196) es una decisión legal pendiente (§15, punto 7).

**Lo que ya está construido (T-02-01 … T-02-04):** los parámetros tienen vigencia, empresa y
sucursal, y el run guarda su copia congelada (`GET /hr/payroll/:id/parameters`); los conceptos
declaran `kind`, `expression` y `affectsIntegralSalary`, y la fórmula se valida al guardar contra una
gramática mínima; el motor **ejecuta** esas fórmulas en tres pasadas (datos del empleado → salario
normal → salario integral), convierte los parámetros en divisa a la moneda del run, registra el costo
patronal aparte y falla con un mensaje claro si el neto queda negativo; y las prestaciones,
vacaciones, bono vacacional y utilidades se calculan con sus topes y se registran con idempotencia
por trimestre y por ejercicio.

**Lo que falta:** la retención de ISLR (requiere la tabla progresiva, decisión P-28), la reversión
(`VOID`) de un run pagado (RN-21) y el mapeo contable por concepto (RN-25, depende de `accounting_maps`
de `S-04`). La épica de nómina (`E2`) queda cerrada en lo funcional: backend, UI y casos legales.

## 15. Decisiones abiertas (requieren validación profesional)

1. **Alícuotas y topes vigentes** de IVSS, paro forzoso y FAOV: los porcentajes cambian por reforma
   y por decreto. Deben confirmarse antes de producción. ⚠️
2. **Monto del cestaticket** y su tratamiento cuando hay inasistencias: se asume pago por días
   efectivos (RN-17); confirmar si la empresa paga mes completo.
3. **Tope de utilidades** aplicable: depende del tamaño de la empresa y de si hay convención
   colectiva que mejore el mínimo legal.
4. **Indemnización por egreso**: el cálculo del Art. 92 depende de la causa y del salario integral
   histórico; se implementará con tabla de días por año y debe validarse caso por caso.
5. **Tarifa de ISLR**: requiere la tabla progresiva vigente y la definición de desgravámenes
   aplicables (HCM, aportes, etc.).
6. **Redondeo**: se adopta `HALF_UP` a 2 decimales en moneda funcional (regla M7 de `S-08`);
   confirmar si la práctica de la empresa redondea por concepto o sobre el neto.
7. **Vacaciones y bono con menos de un año de servicio (H-72)**: `vacationEntitlement(0)` acredita
   15 días de vacaciones y 7 de bono, pero la LOTTT causa el período al cumplir el año (Art. 190) y
   al terminar antes paga **fraccionadas** (Art. 196). Falta definir la fórmula proporcional (¿días
   por mes completo: 1,25 y 0,58?) y si el bono se paga sólo con la vacaciones causadas. Mientras no
   se valide, una liquidación de un empleado con menos de un año sobrepaga. ⚠️

> Ninguna de estas decisiones bloquea el diseño: todas son parámetros o tablas. Pero **sí** deben
> resolverse antes de conectar la UI de cálculo (T-02-03 en adelante).
