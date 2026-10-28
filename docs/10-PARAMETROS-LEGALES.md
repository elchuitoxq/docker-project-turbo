# Parámetros legales de nómina: cómo lo haría SAP y cómo está en este ERP

> Este documento responde al pendiente **P-28** del WBS. No es un tratado legal: es el puente entre
> «la ley dice X» y «el sistema tiene que saber hacerlo». Para cada componente se responde siempre lo
> mismo, en el mismo orden:
>
> 1. **Qué es** (en una frase que entienda alguien de administración).
> 2. **Cómo lo resuelve SAP** (la analogía que ordena el diseño).
> 3. **Qué dice la norma** (con el nivel de confianza de la fuente).
> 4. **Qué hay que decidir** (la decisión es del cliente, no del programador).
> 5. **Cómo se comprueba** que quedó bien.
>
> La misma estructura se repite en la **guía interactiva** del frontend
> (`/dashboard/settings/payroll-guide`), que además muestra el estado real de cada parámetro y un
> simulador. Este documento es la versión larga; la pantalla es la versión usable.

**Advertencia que también está en pantalla:** los bloques marcados como «requiere validación legal»
deben confirmarse con un contador o un abogado laboral antes de facturar en producción. El ERP no
inventa valores: si falta un parámetro crítico, **falla** en vez de calcular con cero (ver
[§4](#4-la-regla-de-oro-fallar-es-mejor-que-adivinar)).

---

## 1. Los cuatro conceptos de SAP que conviene copiar

SAP HCM no calcula la nómina «con fórmulas sueltas»: separa tres cosas que aquí también están
separadas. Copiar esa separación es lo que hace que un cambio de decreto no obligue a tocar código.

| Concepto SAP                                                                            | Qué es                                                                                                       | Dónde vive aquí                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Dato maestro** (infotipos `PA0008`, `PA0014`, `PA0015`)                               | Lo que es distinto para cada empleado: sueldo base, pagos recurrentes, pagos de un solo período.             | `employees`, contratos y los conceptos asignados al empleado.                                |
| **Parámetro legal** (constantes `T511K`, tablas de límites `T51D*`, wage types `T512W`) | Lo que cambia por decreto y aplica a todos: alícuotas, topes, tramos de ISLR, días de utilidades.            | Tabla `payroll_settings` (clave `key` + vigencia) y `income_tax_brackets`.                   |
| **Lógica** (esquema `T52C0` + reglas `T52C5`)                                           | El orden en que se aplican las cosas: primero salario normal, después salario integral, después deducciones. | `apps/backend/src/modules/hr/payroll/payroll.calculator.ts` y las fórmulas de cada concepto. |

Y dos reglas de estilo que SAP aplica en todo el módulo y que aquí se respetan:

- **Todo está fechado.** Cada parámetro tiene `effective_from` / `effective_to`. Un cambio legal es
  un registro nuevo con fecha, nunca un `UPDATE` que reescribe la historia.
- **Deducción del trabajador ≠ aporte del patrono.** Son dos conceptos distintos generados por la
  misma regla. El recibo muestra sólo la deducción; el aporte patronal va al coste y a la
  contabilidad. Confundirlos es el error clásico: el neto del trabajador baja por el IVSS pero no
  por el IVSS patronal.

### Tabla de traducción

| SAP                                                       | Este ERP                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `T512W` wage type con `BEGDA`/`ENDDA`                     | `payroll_concepts` (`kind`: `ASSIGNMENT`, `DEDUCTION`, `EMPLOYER_CONTRIBUTION`, `INFORMATIVE`) |
| Clase de evaluación que excluye un wage type de las bases | `affectsIntegralSalary` y el hecho de que el cestaticket es `INFORMATIVE`                      |
| `T511K` constantes de nómina                              | `payroll_settings` (p. ej. `SSO_EMP`, `TOPE_SSO`, `UNIDAD_TRIBUTARIA`)                         |
| `T51D1` límites de deducción                              | Topes en la fórmula del concepto (`TOPE_SSO`, `TOPE_PARO`)                                     |
| Tabla de tramos de impuesto del país                      | `income_tax_brackets` (tramos en UT con sustraendo)                                            |
| Acumulados `CRT` / `T54C*`                                | Base anual = salario normal mensual × 12, prorrateada a 12 pagos                               |
| Modo simulación del driver                                | El **simulador** de la guía (no graba nada)                                                    |

---

## 2. Componente por componente

### 2.1 IVSS — Seguro Social Obligatorio

- **Qué es.** Un aporte que se descuenta al trabajador y otro que paga la empresa; ambos financian
  el seguro social.
- **Cómo lo resuelve SAP.** Dos wage types generados por la misma regla: uno con clase de
  procesamiento de **deducción** (afecta el neto) y otro marcado como **aporte patronal** (no afecta
  el neto, pero sí el coste). La tasa y el tope son constantes con vigencia, no código.
- **Qué dice la norma.** Trabajador **4 %**. Patrono **9 %, 10 % u 11 %** según la clase de riesgo.
  Base: salario normal con **tope de 5 salarios mínimos**. _Confianza:_ alta en el 4 %, media en el
  tope y en el instrumento que fijó las alícuotas patronales actuales (la ley de 1966 dice 7/8/9 %).
- **Qué hay que decidir.** Confirmar con el IVSS la **clase de riesgo** de la empresa (de ella
  depende la alícuota patronal) y que el tope aplicado sea el de 5 salarios mínimos.
- **Cómo se comprueba.** En el recibo, la línea de seguro social debe ser el 4 % de la base topada, y
  el coste patronal debe aparecer **aparte**, sin restar del neto.
- **Parámetros:** `SSO_EMP`, `SSO_PAT`, `TOPE_SSO`.

### 2.2 Paro forzoso (PIE)

- **Qué es.** El aporte al régimen de prestaciones por desempleo.
- **Cómo lo resuelve SAP.** Exactamente el mismo patrón que el IVSS: deducción + aporte patronal, con
  su **propio** tope. En SAP se distingue del IVSS por wage type y por base, no por código distinto.
- **Qué dice la norma.** Trabajador **0,5 %**, patrono **2 %**, base salario normal con **tope de 10
  salarios mínimos**. _Confianza:_ alta en las tasas, media en la cita legal del tope.
- **Qué hay que decidir.** Confirmar si la empresa está obligada al régimen (hay supuestos de
  exclusión) y el tope aplicable.
- **Cómo se comprueba.** El aporte patronal de paro forzoso **no** debe descontarse del neto.
- **Parámetros:** `PIE_EMP`, `PIE_PAT`, `TOPE_PARO`.

### 2.3 FAOV — Ahorro habitacional (Banavih)

- **Qué es.** Un ahorro obligatorio para vivienda: 1 % del trabajador y 2 % de la empresa.
- **Cómo lo resuelve SAP.** No se configura como fórmula aparte sino como **una base más** (una clase
  de evaluación). Así, cualquier cambio en el salario integral —comisiones, utilidades, bono
  vacacional— se propaga solo a la base del FAOV.
- **Qué dice la norma.** Trabajador **1 %**, patrono **2 %**, base **salario integral**. El tope es
  una **contradicción documental**: unas fuentes dicen «sin tope» y otras citan 10 salarios mínimos.
  _Confianza:_ alta en tasas y base, **baja en el tope**.
- **Qué hay que decidir.** Definir con asesoría legal si se aplica tope y cuál. Mientras no se decida,
  el tope debe quedar **explícito** en el parámetro, no escondido dentro de una fórmula.
- **Cómo se comprueba.** La base del FAOV debe incluir alícuotas de utilidades y bono vacacional, no
  sólo el sueldo.
- **Parámetros:** `FAOV_EMP`, `FAOV_PAT`, `TOPE_FAOV`.

### 2.4 Cestaticket (beneficio de alimentación)

- **Qué es.** Un beneficio para comida. **No es salario**, y por eso no debe entrar en las bases de
  cotización ni en la base de impuesto.
- **Cómo lo resuelve SAP.** Wage type **informativo**, marcado con clases de procesamiento que lo
  excluyen de las bases de cotización y de impuesto, y una regla que paga **por jornada efectiva**
  usando el campo de número como días. La inasistencia se resuelve reduciendo días, no cambiando el
  importe.
- **Qué dice la norma.** La **Ley de Alimentación para los Trabajadores** (Gaceta 39.666 del
  04/05/2011) fija **0,25 a 0,50 UT por jornada**, lo declara **no salarial** y limita la provisión
  mensual al **30 %** de (salario + beneficio). Se mantiene en vacaciones, incapacidad ≤ 12 meses,
  pre y post natal, paternidad y ausencias no imputables. _Confianza:_ **alta**.
  La práctica de pagar un monto fijo en divisas (p. ej. US$ 40/mes) **no tiene base normativa
  verificada**: es política interna, no derecho. Con UT de 43 Bs, 0,25 UT ≈ 10,75 Bs/día, lo que
  explica por qué el mercado se movió a un monto fijo, pero la ley sigue expresada en UT.
- **Qué hay que decidir.** Elegir entre la vía legal (UT por jornada) o una política interna en
  divisas. Si se usa un monto fijo, debe quedar documentado **como política de la empresa** y
  separado del parámetro legal.
- **Cómo se comprueba.** El cestaticket no debe aparecer en la base de IVSS, paro forzoso ni FAOV, ni
  sumar al salario integral.
- **Parámetro:** `CESTATICKET_USD`.

### 2.5 Utilidades (reparto de beneficios)

- **Qué es.** El reparto anual de una parte de las ganancias, expresado en **días de salario**.
- **Cómo lo resuelve SAP.** Tabla de días por ejercicio con vigencia + una **validación de tope**
  antes de generar el pago. El tope depende del tamaño de la empresa, así que es un parámetro, no una
  constante del código.
- **Qué dice la norma.** Referencia estándar: mínimo **15 días**, máximo **4 meses**; **2 meses** para
  empresas con capital por debajo del umbral legal; proporcional para antigüedad menor a un año.
  _Confianza:_ **baja / no verificado** — no se pudo leer el texto vigente de los artículos 131 a 133
  de la LOTTT, y una fuente secundaria afirma «mínimo 30 días», lo que contradice la referencia.
- **Qué hay que decidir.** Confirmar el tope aplicable (4 o 2 meses) y si hay convención colectiva que
  mejore el mínimo.
- **Cómo se comprueba.** El monto pagado no debe superar el tope configurado ni bajar de 15 días.
- **Parámetros:** `DIAS_UTILIDADES`, `TOPE_UTILIDADES_MESES`.

### 2.6 Vacaciones y bono vacacional

- **Qué es.** El descanso anual remunerado y el bono que lo acompaña.
- **Cómo lo resuelve SAP.** Días acumulados por año de servicio en una tabla con vigencia + una regla
  de proporcionalidad por mes completo para el egreso. El bono se calcula como alícuota diaria del
  salario normal.
- **Qué dice la norma.** **15 días hábiles + 1 por año** hasta 15 adicionales (Art. 190) y bono de
  **15 días + 1 por año** (Art. 192). Al terminar antes de cumplir el año corresponden vacaciones
  **fraccionadas** (Art. 196), a razón de **1,25 días por mes completo**. _Confianza:_ media en la
  regla general, **baja en el texto del Art. 196** (no verificado).
- **Qué hay que decidir.** Definir la fórmula de fraccionadas y si un empleado con menos de un año ya
  causa el período. Hoy el motor acredita 15 + 7 días desde el día uno (**H-72**), lo que sobrepaga
  una liquidación temprana.
- **Cómo se comprueba.** Una liquidación de alguien con pocos meses no debe pagar vacaciones
  completas.
- **Parámetros:** `DIAS_VACACIONES_BASE`, `DIAS_BONO_VACACIONAL`, `TOPE_DIAS_VACACIONES_EXTRA`.

### 2.7 ISLR — retención sobre la renta

- **Qué es.** El impuesto progresivo que se le retiene al trabajador sobre su sueldo.
- **Cómo lo resuelve SAP.** Tabla de tramos en Customizing (límite inferior y superior, tasa y
  **sustraendo**), **valor de la UT como constante con vigencia**, **base anual acumulada** en `CRT`
  con períodos de cumulación (`T54C0` fija el inicio del año fiscal) y **anualización + prorrateo**
  por período. El motor sólo aplica la tabla: si falta, el cálculo se **bloquea** en lugar de asumir
  cero.
- **Qué dice la norma.** Ocho tramos en UT (Art. 50 de la Ley de ISLR), cada uno con su sustraendo
  para que la tarifa sea continua:

  | Desde (UT) | Hasta (UT) | Tasa | Sustraendo (UT) |
  | ---------- | ---------- | ---- | --------------- |
  | 0          | 1.000      | 6 %  | 0               |
  | 1.000      | 1.500      | 9 %  | 30              |
  | 1.500      | 2.000      | 12 % | 75              |
  | 2.000      | 2.500      | 16 % | 155             |
  | 2.500      | 3.000      | 20 % | 255             |
  | 3.000      | 4.000      | 24 % | 375             |
  | 4.000      | 6.000      | 29 % | 575             |
  | 6.000      | ∞          | 34 % | 875             |

  `impuesto anual = (renta en UT × tasa − sustraendo) × valor de la UT`, y la retención mensual es
  `impuesto anual / 12`. **UT = 43,00 Bs desde el 02/06/2025** (Providencia SNAT/2025/0048).
  La renta no es el sueldo completo: se le restan los **desgravámenes** (aportes obligatorios del
  trabajador). El **descuento único anual** está en disputa (**Bs. 774** nominal histórico vs.
  **774 UT**), por eso quedó en **0** y se modeló como parámetro con unidad explícita. _Confianza:_
  alta en la tabla y su continuidad, media en la vigencia de la UT y en la lista de desgravámenes,
  **baja en el descuento único**.

- **Desgravámenes en el sistema (`P-30`).** Cada concepto declara si su importe resta de la base
  (`reduces_income_tax_base`). En el seed están marcados IVSS, paro forzoso y FAOV del trabajador; el
  motor suma **lo efectivamente descontado** (no el porcentaje teórico, así que los topes se
  respetan) y aplica la tarifa sobre el resto. Marcar una asignación no cambia la base: sólo restan
  deducciones. **Qué conceptos desgravan es una decisión del contador**: hoy es una casilla en
  Configuración → Conceptos de nómina.

- **Qué hay que decidir.** Validar el descuento único contra la Gaceta, confirmar si hubo reajuste de
  la UT en 2026 y qué desgravámenes aplican (¿sólo aportes sociales, o también HCM y otros?). Sin la
  tabla cargada el run **no se genera**: es intencional.
- **Cómo se comprueba.** Cada tramo debe cuadrar al céntimo y la retención del recibo tiene que
  coincidir con la del asiento. Ojo: con el descuento único en 0 **todo ingreso positivo retiene
  algo**, porque la tarifa arranca al 6 % desde la primera unidad tributaria; el mínimo exento no
  existe en la tabla, vive en el descuento único.
- **Parámetros:** `UNIDAD_TRIBUTARIA`, `ISLR_DESCUENTO_UNICO` + tabla `income_tax_brackets`.

---

## 3. Estado de los parámetros en el sistema

| Parámetro                                | Unidad  | Fuente                        | Confianza |
| ---------------------------------------- | ------- | ----------------------------- | --------- |
| `SSO_EMP`                                | %       | Ley del Seguro Social         | alta      |
| `SSO_PAT`                                | %       | clase de riesgo de la empresa | media     |
| `TOPE_SSO`                               | Bs/mes  | 5 salarios mínimos            | media     |
| `PIE_EMP`                                | %       | Ley de Paro Forzoso           | alta      |
| `PIE_PAT`                                | %       | Ley de Paro Forzoso           | alta      |
| `TOPE_PARO`                              | Bs/mes  | 10 salarios mínimos           | media     |
| `FAOV_EMP`                               | %       | Ley de Vivienda y Hábitat     | alta      |
| `FAOV_PAT`                               | %       | Ley de Vivienda y Hábitat     | alta      |
| `TOPE_FAOV`                              | Bs/mes  | **en disputa**                | baja      |
| `CESTATICKET_USD`                        | USD/mes | práctica de mercado           | baja      |
| `DIAS_UTILIDADES`                        | días    | LOTTT 131–133                 | baja      |
| `TOPE_UTILIDADES_MESES`                  | meses   | LOTTT 131–133                 | baja      |
| `DIAS_VACACIONES_BASE`                   | días    | LOTTT 190                     | alta      |
| `DIAS_BONO_VACACIONAL`                   | días    | LOTTT 192                     | alta      |
| `TOPE_DIAS_VACACIONES_EXTRA`             | días    | LOTTT 190                     | media     |
| `UNIDAD_TRIBUTARIA`                      | Bs/UT   | Providencia SNAT/2025/0048    | media     |
| `ISLR_DESCUENTO_UNICO`                   | Bs/año  | **en disputa**                | baja      |
| `reduces_income_tax_base` (por concepto) | sí/no   | criterio contable             | media     |
| `income_tax_brackets`                    | UT + %  | Ley de ISLR Art. 50           | alta      |

`GET /v1/hr/income-tax-table?asOf=YYYY-MM-DD` devuelve la tabla vigente en esa fecha junto con el
valor de la UT (`hr:settings:view`). `GET /v1/hr/settings` devuelve el resto de los parámetros con la
precedencia **sucursal > empresa** (RN-23).

---

## 4. La regla de oro: fallar es mejor que adivinar

Un ERP que **supone** un valor legal produce liquidaciones mal pagadas y, peor, difíciles de
detectar. Por eso:

- Si falta la tabla de ISLR, el run **no se genera** y el mensaje dice qué falta.
- Si falta un tope, la fórmula **no lo inventa**: el parámetro queda vacío y la guía lo marca en rojo.
- Si un valor tiene fuente de confianza **baja**, la guía lo muestra como **«Revisar»** aunque el
  número esté cargado: el problema no es el dato, es que nadie lo ha confirmado.

---

## 5. La guía interactiva del frontend

| Pieza                                                         | Dónde                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| Contenido de los 7 bloques (ley, SAP, decisión, comprobación) | `apps/frontend/lib/payroll-guide.ts`                             |
| Estado y progreso (puro, con tests)                           | `itemStatus`, `guideProgress` en el mismo archivo                |
| Pantalla                                                      | `apps/frontend/modules/hr/components/payroll-guide-view.tsx`     |
| Ruta                                                          | `/dashboard/settings/payroll-guide` (permiso `hr:settings:view`) |

La pantalla hace tres cosas:

1. **Muestra el estado real**: cuenta cuántos bloques están configurados, a revisar o pendientes
   leyendo `/hr/settings`, no una lista escrita a mano. Si alguien cambia un valor, la guía cambia.
2. **Explica**: cada bloque repite la estructura de este documento en cuatro recuadros (cómo lo
   resuelve SAP, lo que dice la norma, qué hay que decidir, cómo se comprueba) y muestra los
   parámetros del bloque con su valor actual.
3. **Simula**: con un sueldo mensual calcula IVSS, paro forzoso, FAOV e ISLR con los **mismos**
   parámetros y la misma aritmética que el backend (`computeIslr` replica `income-tax.ts` y resta los
   conceptos marcados como desgravables, igual que el motor), para ver el efecto de un cambio
   **antes** de tocarlo. No graba nada, igual que el modo simulación del driver de SAP.

Pruebas: `apps/frontend/lib/payroll-guide.test.ts` (estado de los bloques, progreso, desgravámenes y
paridad de `computeIslr`), `apps/backend/src/modules/hr/payroll/payroll.calculator.test.ts`
(desgravámenes: qué resta, topes, base mínima) y `apps/backend/src/modules/hr/payroll/income-tax.test.ts`
(bordes de cada tramo y fallo sin tabla).

---

## 6. Qué falta para cerrar P-28 del todo

| Pendiente                                     | Por qué no se resolvió aquí                                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Texto del descuento único (Arts. 60/61 LISLR) | Contradicción de unidad (Bs. vs UT) sin Gaceta accesible. Queda en 0 y parametrizado.                                   |
| Reajuste de la UT en 2026                     | Sólo está confirmado el valor de 43 Bs desde el 02/06/2025.                                                             |
| Tope del FAOV                                 | Contradicción documental; el parámetro existe pero su valor es una decisión jurídica.                                   |
| Art. 92 / 142 / 196 LOTTT                     | Sin texto oficial verificado no se fijan días ni prorrateos (**H-72** depende de esto).                                 |
| Cestaticket en divisas                        | No hay base normativa; se modela como política interna.                                                                 |
| Lista cerrada de desgravámenes                | El mecanismo está (`P-30`); falta que el contador confirme si además de los aportes obligatorios desgravan HCM u otros. |

Cerrarlos es trabajo de validación legal, no de programación: cuando llegue la respuesta, se cambia
**un parámetro** y la nómina cambia con él.

---

## 7. Referencias

- SAP Help Portal — _Tables_ (T512W, T511K) y `sapdatasheet.org` para el inventario del paquete
  `PCAL` (T52C0/T52C1 esquemas, T52C5 reglas, T52D1–T52D4 clases de evaluación, T51D1/D3/D4 límites,
  T54C0/C3/C6 cumulación, T569V control record).
- PwC _Worldwide Tax Summaries_ — Venezuela, _Taxes on personal income_ y _Other taxes_
  (tabla del Art. 50, UT, IVSS/paro forzoso/FAOV, mínimo).
- Ley de Alimentación para los Trabajadores y las Trabajadoras (Gaceta 39.666 del 04/05/2011).
- Providencia Administrativa SNAT/2025/0048 (UT de 43 Bs desde el 02/06/2025).
- LOTTT (Gaceta 6.076 Extraordinaria del 30/04/2012), arts. 131–133, 190, 192, 196.
