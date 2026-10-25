# FISCALIDAD VENEZUELA - REGLAS SENIAT 2025-2026

## 1. Digital Billing - Providencia 0102

### Contexto
**Providencia Administrativa SNAT/2024/000102** - Transición a facturación digital.

### Requisitos

| Campo | Descripción |
|-------|-------------|
| Serial/Control | Números de control para "Imprentas Digitales" |
| RIF | Identificación fiscal del emisor/receptor |
| Fecha/Hora | Timestamp preciso |
| Descripción Detallada | Descripción completa de productos/servicios |
| Códigos de Producto | SKU o código oficial |
| Referencia Providencia | Mención a la normativa |

### Formato de Exportación
- XML/JSON estandarizado para SENIAT
- Consultar modelos "Verifactu" o Ecuador como referencia

### Reglas
- **Invoices inmutables** una vez POSTED
- Soporte para "Imprentas Digitales" (seriales de control)

---

## 2. Retenciones de Impuestos (Agente de Retención)

### Contexto
"Sujetos Pasivos Especiales" (SPE) deben retener IVA e ISLR.

### Implementación Unificada (Camino Atómico)

```typescript
// PROBLEMA: Separar Payment (reducción deuda) de Voucher (documento fiscal)
// causa inconsistencia de datos y errores FK

// SOLUCIÓN: Camino Unificado
// Cuando usuario registra pago con método RET_* (ej. RET_IVA_75):
// 1. Frontend envía payment data
// 2. TreasuryService detecta el método
// 3. Llama RetentionsService.createRetention PASANDO la tx activa
// 4. Payment record + Fiscal Voucher se crean atómicamente

// RESULTADO: Cero "Orphan Retentions"
```

### 2.1 Retención IVA

| Aspecto | Detalle |
|---------|---------|
| **Trigger** | Automático al registrar factura de compra O selección manual de pago |
| **Tasa** | 75% o 100% del monto de impuesto, definido por `supplier.retentionRate` |
| **Voucher** | Debe generar "Comprobante de Retención" (PDF + XML) |
| **Fórmula** | `RetentionAmount = TotalTax * (RetentionRate / 100)` |

```typescript
// Ejemplo:
totalTax = 100.00
retentionRate = 75  // del partner
RetentionAmount = 100.00 * (75 / 100) = 75.00
```

### 2.2 Retención ISLR (Decreto 1808)

| Aspecto | Detalle |
|---------|---------|
| **Trigger** | Payment o acreditación de cuenta (el primero) |
| **Base** | Decreto 1.808. Requiere tabla de conceptos |
| **Fórmula** | `(Base * %Retention) - Sustraendo` |
| **Sustraendo** | Dependiente de Unidad Tributaria (U.T.) |

```typescript
// En schema.ts - tax_concepts
taxConcepts = {
  code: "001",
  name: "Honorarios Profesionales",
  retentionPercentage: 3.00,  // 3%
  baseMin: 100,              // Mínimo en U.T.
  sustraendo: 0              // Factor de sustraendo
}

// Ejemplo cálculo:
base = 1000 USD
retentionPercentage = 3%
sustraendo = 0
RetentionAmount = (1000 * 0.03) - 0 = 30.00 USD
```

### Conceptos ISLR Típicos

| Código | Concepto | Tasa | Sustraendo |
|--------|----------|------|------------|
| 001 | Honorarios Profesionales | 3% | 0 |
| 002 | Arrendamiento de Bienes Muebles | 5% | 0 |
| 003 | Fletes | 5% | 0 |
| 004 | Jubilaciones | 3% | 0 |
| 005 | Pensiones | 3% | 0 |

---

## 3. IGTF (Impuesto Grandes Transacciones Financieras)

### Contexto
**3%** sobre pagos realizados en moneda extranjera (no VES) dentro del sistema bancario o contribuyentes especiales.

### Reglas Clave

```typescript
// Aplica 3% SOLO sobre la porción pagada en moneda extranjera
// Se discrimina en la Invoice como totalIgtf

if (applyIgtf && currency.code !== 'VES') {
  totalIgtf = (totalBase + totalTax) * 0.03
}
```

### Casos de Aplicación

| Caso | Aplica IGTF? | Razón |
|------|--------------|-------|
| Pago en USD (banco) | ✅ Sí | Moneda extranjera |
| Pago en EUR (banco) | ✅ Sí | Moneda extranjera |
| Pago en VES (bolívares) | ❌ No | Moneda local |
| Pago en Petro | ❌ No | Exento |
| Pago mixto (USD + VES) | ✅ Solo USD | Solo porción extranjera |

### En Factura

```typescript
invoice = {
  totalBase: 100.00,     // Base imponible
  totalTax: 16.00,      // IVA 16%
  totalIgtf: 3.48,      // (100 + 16) * 0.03 = 3.48
  total: 119.48         // 100 + 16 + 3.48
}
```

### Reporting
- Columna específica en "Libro de Ventas"
- Obligatorio discriminar IGTF en factura

---

## 4. Sistema Monetario y BCV

### Tasas de Cambio

| Aspecto | Regla |
|---------|-------|
| **Tasa Oficial** | TODOS los cálculos fiscales deben usar tasa oficial BCV de la fecha de operación |
| **Automación** | Sistema debe hacer pull diario de BCV API (o scraper robusto) |
| **Histórico** | Debe preservar la tasa en el momento de la transacción (`exchangeRate` snapshot) |
| **Display Dual** | Precios pueden mostrarse en USD, pero factura fiscal es fundamentalmente VES |

### BCV Scraper Service

```typescript
// cron/bcv-scraper.service.ts

@Cron('0 8-18/1 * * *')  // Cada hora de 8am a 6pm
async handleCron() {
  await this.scrapeRates();
}

async scrapeRates() {
  // Hace scrape de https://www.bcv.org.ve/
  // Extrae USD y EUR
  // Guarda en exchange_rates con source: 'BCV_SCRAPER'
}
```

### Snapshot de Tasa

```typescript
// En invoices
invoice = {
  exchangeRate: 35.27063,  // Snapshot de la tasa en momento de creación
  totalBase: 100.00,       // En USD
  // totalBaseVES = 100 * 35.27063 = 3527.06 VES
}
```

---

## 5. Calendario Fiscal y Reportes

### 5.1 Libros de Compra y Venta

```typescript
// ⚠️ MONEDA ESTRICTAMENTE VES
// Conversión requerida para facturas en moneda extranjera
// Usa rate.histórico de fecha de emisión
```

### Columnas Estructuradas (Crítico)

| Columna | Descripción |
|---------|-------------|
| **Total Factura** | Monto completo (Base + Impuesto) |
| **Base Imponible** | Base gravable |
| **IVA / Débito Fiscal** | Muestra **100%** del impuesto (Derecho a Crédito/Débito Fiscal) |
| **IVA Retenido** | Monto retenido (75% o 100%) en **columna separada** |
| **N° Comprobante** | Obligatorio si existe retención |

```sql
-- Estructura Visual del Libro de Ventas
| N° | Fecha | RIF | Invoice | Control | Total | Base | IVA | IVA Retenido | Comprobante |
|----|-------|-----|---------|---------|-------|------|----|--------------|-------------|
| 1  | ...   | J- | A-00001 | 123456  | 119.48| 100 | 16 | 12.00        | 202401-001  |
```

### Resumen/Footer del Reporte

```
Total Impuesto Retenido a Terceros: $XXX.XX (Payable to SENIAT)
```

### 5.2 Contribución Pensionál (2024/2025)

- Nueva responsabilidad desde 2024/2025
- Calculada sobre "Total Pagos a Trabajadores" (Salarios + Bonificaciones)

### 5.3 Alertas

- Sistema debe alertar a SPEs sobre fechas límite de declaración
- Basado en dígito terminal del RIF

---

## 6. Reglas Críticas para Reportes

```typescript
// ⚠️ FILTRAR SIEMPRE POR Operation Date (date)
// NUNCA por System Creation Date (createdAt)
// Esto asegura que documentos con fecha atrasada aparezcan en el período correcto

// filter
where = {
  date: { gte: startDate, lte: endDate }  // ✅ Correcto
  // createdAt: { gte: startDate }        // ❌ Incorrecto
}

// Consistency: TXT y Reporte Visual deben usar IDENTICAL identifiers
// - Factura: usar invoiceNumber (o code si legacy)
// - Control: usar code (standard field)
// - RIF: mapear Agent (Branch) y Retained (Partner)
```

---

## 7. Checklist para Nuevas Features

Al implementar cualquier feature en `billing` o `accounting`:

```typescript
// 1. ¿Maneja multi-moneda correctamente (guardando rate)?
checkMultiCurrency()

// 2. ¿Calcula IGTF si aplica?
checkIGTF()

// 3. Si es Purchase, ¿pidió número de control?
checkControlNumber()

// 4. Si es Pago a Supplier, ¿verificó Retenciones?
checkRetentions()
```

---

## 8. Flujo de Documentos Fiscales

```
┌─────────────────────────────────────────────────────────────────┐
│  FACTURA DE VENTA                                               │
│  ─────────────────                                              │
│  Status: POSTED (no puede modificarse)                         │
│  Fields: code (A-00001), invoiceNumber, fiscalStatus         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Payment
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PAYMENT                                                        │
│  ───────                                                        │
│  Si methodCode.startsWith('RET_'):                             │
│    → Crear tax_retention dentro de la MISMA transacción         │
│    → Generar XML del comprobante                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Credit Note si sobrepago
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CREDIT NOTE (NC-ADV- prefix)                                  │
│  ──────────────────────────────                                 │
│  Status: POSTED                                                 │
│  Puede usarse para cruzar balances (BALANCE_USD/VES)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Códigos de Impuestos en DB

### Payment Methods para Retenciones

| Code | Descripción | Genera Comprobante |
|------|-------------|-------------------|
| RET_IVA_75 | Retención IVA 75% | ✅ Sí |
| RET_IVA_100 | Retención IVA 100% | ✅ Sí |
| RET_ISLR | Retención ISLR | ✅ Sí |

### Flujo de Retención Unificado

```typescript
// treasury.service.ts
if (methodCode.startsWith('RET_')) {
  // Detecta automáticamente
  // Crea payment + tax_retention en la misma tx
  await tx.insert(taxRetentions, {...})
}
```

---

## 10. Tipos de taxpayer (Partners)

| Type | Descripción | Retention Rate Típico |
|------|-------------|----------------------|
| ORDINARY | Contribuyente ordinario | 0% (no retiene) |
| SPECIAL | Sujeto Pasivo Especial | 75% o 100% |
| FORMAL | Contributor formal | 0% |

```typescript
partner = {
  taxpayerType: "SPECIAL",
  isSpecialTaxpayer: true,
  retentionRate: 75  // retiene 75% del IVA
}
```
