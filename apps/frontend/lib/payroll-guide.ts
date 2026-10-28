/**
 * Guía de parámetros legales de nómina (`P-28`).
 *
 * Cada bloque responde tres preguntas: **qué dice la ley**, **cómo lo resuelve SAP** y **qué
 * decisión tiene que tomar la empresa**. El estado se calcula contra los parámetros reales, no
 * contra una lista escrita a mano: si alguien cambia un valor, la guía lo refleja.
 */

export type GuideConfidence = 'alta' | 'media' | 'baja';
export type GuideStatus = 'configurado' | 'revisar' | 'pendiente';

export type GuideItem = {
  id: string;
  /** Qué es, en una frase que entienda alguien de administración. */
  summary: string;
  /** Cómo lo modela SAP: la analogía que ordena el diseño. */
  sap: string;
  /** Lo que dice la norma, con el nivel de confianza de la fuente. */
  legal: string;
  confidence: GuideConfidence;
  /** Parámetros del ERP que lo controlan. */
  keys: string[];
  /** Qué tiene que decidir el cliente o su contador. */
  decision: string;
  /** Cómo se comprueba que quedó bien. */
  check: string;
};

export const GUIDE_ITEMS: GuideItem[] = [
  {
    id: 'ivss',
    summary:
      'Aporte al Seguro Social Obligatorio: lo descuenta al trabajador y lo paga el patrono.',
    sap: 'Dos wage types separados generados por la misma regla: uno con clase de procesamiento de deducción (afecta el neto) y otro de aporte patronal (no lo afecta, pero va al coste). La tasa y el tope son constantes con vigencia.',
    legal:
      'Trabajador 4 %. Patrono 9 %, 10 % u 11 % según la clase de riesgo. Base: salario normal con tope de 5 salarios mínimos.',
    confidence: 'media',
    keys: ['SSO_EMP', 'SSO_PAT', 'TOPE_SSO'],
    decision:
      'Confirmar la clase de riesgo de la empresa con el IVSS: de ella depende la alícuota patronal. Y confirmar que el tope aplicado es el de 5 salarios mínimos.',
    check:
      'En el recibo, la línea de seguro social debe ser el 4 % de la base topada y el costo patronal debe aparecer aparte.',
  },
  {
    id: 'pie',
    summary: 'Paro forzoso: financiamiento del régimen de prestaciones por desempleo.',
    sap: 'Mismo patrón que el seguro social: deducción + aporte patronal con su propio tope. En SAP se distingue del IVSS por wage type y por base, no por código.',
    legal: 'Trabajador 0,5 %. Patrono 2 %. Base: salario normal con tope de 10 salarios mínimos.',
    confidence: 'alta',
    keys: ['PIE_EMP', 'PIE_PAT', 'TOPE_PARO'],
    decision:
      'Confirmar si la empresa está obligada al régimen (existen supuestos de exclusión) y el tope aplicable.',
    check: 'El aporte patronal de paro forzoso no debe descontarse del neto del trabajador.',
  },
  {
    id: 'faov',
    summary:
      'Ahorro habitacional (Banavih): 1 % del trabajador y 2 % del patrono sobre salario integral.',
    sap: 'Se configura como una base más (clase de evaluación) y no como una fórmula aparte: así cualquier cambio en el salario integral se propaga solo.',
    legal:
      'Trabajador 1 %, patrono 2 %, base salario integral. El tope es una contradicción documental: hay fuentes que dicen «sin tope» y otras que citan 10 salarios mínimos.',
    confidence: 'baja',
    keys: ['FAOV_EMP', 'FAOV_PAT', 'TOPE_FAOV'],
    decision:
      'Definir con asesoría legal si se aplica tope y cuál. Mientras no se decida, el tope debe quedar explícito (no implícito en la fórmula).',
    check:
      'La base del FAOV debe incluir alícuotas de utilidades y bono vacacional, no sólo el sueldo.',
  },
  {
    id: 'cestaticket',
    summary:
      'Beneficio de alimentación: no es salario y no debe entrar en las bases de cotización.',
    sap: 'Wage type informativo con clase de evaluación que lo excluye de las bases de cotización y de impuesto, y una regla de pago por días efectivos para manejar inasistencias.',
    legal:
      'La Ley de Alimentación fija 0,25 a 0,50 UT por jornada, lo declara no salarial y limita la provisión mensual al 30 % de (salario + beneficio). La práctica de pagar un monto fijo en divisas (por ejemplo US$ 40) no tiene base normativa verificada.',
    confidence: 'alta',
    keys: ['CESTATICKET_USD'],
    decision:
      'Elegir entre la vía legal (UT por jornada) o una política interna en divisas. Si se usa un monto fijo, dejarlo documentado como política de la empresa y no como obligación legal.',
    check:
      'El cestaticket no debe aparecer en la base de IVSS, paro forzoso ni FAOV, ni sumar al salario integral.',
  },
  {
    id: 'utilidades',
    summary: 'Reparto de utilidades: días a pagar y tope legal según la empresa.',
    sap: 'Tabla de días por ejercicio con vigencia y una validación de tope antes de generar el pago; el tope depende del tamaño de la empresa, así que es un parámetro, no una constante del código.',
    legal:
      'Mínimo 15 días y máximo 4 meses; 2 meses para empresas con capital menor al umbral legal. Proporcional para antigüedad menor a un año. No se pudo verificar el texto vigente de los artículos 131 a 133.',
    confidence: 'baja',
    keys: ['DIAS_UTILIDADES', 'TOPE_UTILIDADES_MESES'],
    decision:
      'Confirmar el tope aplicable (4 o 2 meses) y si hay convención colectiva que mejore el mínimo.',
    check: 'El monto pagado no debe superar el tope configurado ni bajar de 15 días.',
  },
  {
    id: 'vacaciones',
    summary: 'Vacaciones y bono vacacional: días base, días adicionales y prorrateo al egreso.',
    sap: 'Días acumulados por año de servicio con tabla de vigencia y una regla de proporcionalidad por mes completo para el egreso; el bono se calcula como alícuota diaria del salario normal.',
    legal:
      '15 días hábiles + 1 por año hasta 15 adicionales, y bono de 15 días + 1 por año. Al terminar antes de cumplir el año corresponden vacaciones **fraccionadas** (Art. 196), a razón de 1,25 días por mes completo. Pendiente de validar el texto.',
    confidence: 'media',
    keys: ['DIAS_VACACIONES_BASE', 'DIAS_BONO_VACACIONAL', 'TOPE_DIAS_VACACIONES_EXTRA'],
    decision:
      'Definir la fórmula de fraccionadas y si un empleado con menos de un año ya causa el período. Hoy el motor acredita 15 + 7 días desde el día uno (H-72).',
    check: 'Una liquidación de alguien con pocos meses no debe pagar vacaciones completas.',
  },
  {
    id: 'islr',
    summary: 'Retención de ISLR: tarifa progresiva por tramos en unidades tributarias.',
    sap: 'Tabla de tramos en Customizing (límite inferior y superior, tasa y sustraendo), valor de la UT como constante con vigencia, base anual acumulada y prorrateo mensual. El motor sólo aplica la tabla; si falta, el cálculo se bloquea.',
    legal:
      'Ocho tramos en UT: 6 % hasta 1.000, 9 % hasta 1.500, 12 % hasta 2.000, 16 % hasta 2.500, 20 % hasta 3.000, 24 % hasta 4.000, 29 % hasta 6.000 y 34 % por encima, cada uno con su sustraendo. La base es el salario menos los desgravámenes: los aportes obligatorios del trabajador se restan antes de aplicar la tarifa. UT de 43 Bs desde el 02/06/2025. El descuento único anual está en disputa (¿Bs. 774 o 774 UT?), por eso quedó en 0.',
    confidence: 'media',
    keys: ['UNIDAD_TRIBUTARIA', 'ISLR_DESCUENTO_UNICO'],
    decision:
      'Validar el descuento único con la Gaceta, confirmar si hubo reajuste de la UT y qué aportes desgravan. Sin la tabla cargada el run no se genera: es intencional.',
    check:
      'Cada tramo debe cuadrar al céntimo y la retención del recibo tiene que coincidir con la del asiento. Ojo: con el descuento único en 0 todo ingreso positivo retiene algo, porque la tarifa arranca al 6 % desde la primera unidad tributaria.',
  },
];

/** Valores vigentes por clave (los que devuelve `/hr/settings`). */
export type SettingValues = Record<string, number>;

/** Un tramo de la tarifa del Art. 50 tal como lo devuelve `/hr/income-tax-table`. */
export type IncomeTaxBracket = {
  fromUt: number;
  toUt: number | null;
  rate: number;
  discountUt: number;
};

function has(values: SettingValues, key: string): boolean {
  const value = values[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Suma los importes de los conceptos que la empresa marcó como desgravables (`P-30`). El simulador
 * lo usa para restarlos de la base antes de aplicar la tarifa, igual que el motor.
 */
export function sumTaxDeductions(
  amounts: Record<string, number>,
  desgravableCodes: Iterable<string>
): number {
  const flagged = new Set(desgravableCodes);

  return Object.entries(amounts)
    .filter(([code]) => flagged.has(code))
    .reduce((acc, [, amount]) => acc + amount, 0);
}

/**
 * Estimación de la retención mensual de ISLR (`RN-09`) con la misma aritmética que el backend
 * (`income-tax.ts`), para poder simular cambiando el sueldo sin llamar a la API en cada tecla.
 */
export function computeIslr(
  annualBase: number,
  brackets: IncomeTaxBracket[],
  utValue: number,
  singleDiscount = 0
): number {
  if (brackets.length === 0 || !utValue || utValue <= 0) return 0;

  const taxableUt = Math.max(0, annualBase) / utValue;
  const bracket =
    brackets.find(
      item => taxableUt >= item.fromUt && (item.toUt === null || taxableUt < item.toUt)
    ) ?? brackets[brackets.length - 1];

  const annualTax = Math.max(0, taxableUt * bracket.rate - bracket.discountUt) * utValue;
  const discount = Math.min(Math.max(0, singleDiscount), annualTax);

  return Math.round(((annualTax - discount) / 12 + Number.EPSILON) * 100) / 100;
}

/**
 * Estado de un bloque: `configurado` si todos sus parámetros tienen valor, `pendiente` si no hay
 * ninguno y `revisar` si está a medias o si la fuente legal es de confianza baja.
 */
export function itemStatus(item: GuideItem, values: SettingValues): GuideStatus {
  const present = item.keys.filter(key => has(values, key)).length;

  if (present === 0) return 'pendiente';
  if (present < item.keys.length) return 'revisar';
  if (item.confidence === 'baja') return 'revisar';

  return 'configurado';
}

export function guideProgress(
  items: GuideItem[],
  values: SettingValues
): { configured: number; pending: number; review: number; total: number; percent: number } {
  const statuses = items.map(item => itemStatus(item, values));

  const configured = statuses.filter(status => status === 'configurado').length;
  const pending = statuses.filter(status => status === 'pendiente').length;
  const review = statuses.filter(status => status === 'revisar').length;

  return {
    configured,
    pending,
    review,
    total: items.length,
    percent: items.length === 0 ? 0 : Math.round((configured / items.length) * 100),
  };
}
