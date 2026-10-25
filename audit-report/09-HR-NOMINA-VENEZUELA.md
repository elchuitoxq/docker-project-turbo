# RECURSOS HUMANOS Y NÓMINA VENEZUELA

## Resumen de Módulos HR

| Entidad | Descripción |
|---------|-------------|
| `employees` | Datos personales, laborales y bancarios |
| `banks` | Catálogo maestro de bancos (SUDEBAN) |
| `job_positions` | Cargos y tabuladores salariales |
| `departments` | Departamentos por sucursal |
| `employee_contracts` | Contratos (INDEFINIDO, DETERMINADO, OBRA) |
| `employee_benefits` | Vacaciones, bonificaciones |
| `employee_vacations` | Vacaciones por año |
| `employee_profit_sharing` | Utilidades |
| `payroll_runs` | Corridas de nómina |
| `payroll_items` | Detalle por empleado |
| `payroll_item_lines` | Líneas de concepto |
| `payroll_settings` | Configuraciones (CESTATICKET, SSO%, etc.) |
| `payroll_concept_types` | Tipos de conceptos |
| `payroll_incidents` | Novedades (horas extra, tardanzas) |
| `employee_salary_history` | Histórico de salarios |

---

## 1. Estructura de employees

```typescript
employees = {
  // Identificación
  firstName: string
  lastName: string
  identityCard: string  // CI (unique)
  
  // Contacto
  email: string
  phone: string
  
  // Org structure
  positionId: UUID → job_positions
  departmentId: UUID → departments
  branchId: UUID → branches
  
  // Fechas
  hireDate: timestamp
  terminationDate: timestamp  // Cuando dejó
  terminationReason: string
  
  // Salario
  salaryCurrencyId: UUID → currencies  // USD o VES
  baseSalary: numeric(20,2)  // Salario mensual base
  payFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  
  // Pago
  paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'MOBILE_PAYMENT'
  bankId: UUID → banks
  
  // ⚠️ LEGACY: campos que deberían normalizarse
  bankName: string
  accountNumber: string
  accountType: 'CHECKING' | 'SAVINGS'
  
  status: 'ACTIVE' | 'INACTIVE'
}
```

---

## 2. Contratos (LOTTT)

### Tipos de Contrato

| Type | Descripción | Duración |
|------|-------------|----------|
| INDEFINIDO | Sin tiempo definido | Indefinido |
| DETERMINADO | Tiempo fijo | Plazo específico |
| OBRA | Hasta completar obra | Variable |

### Período de Prueba (Art. 80 LOTTT)

```typescript
contract = {
  trialPeriodEnd: timestamp,  // 90 días máximo según LOTTT
  // Después del trial period, se considera 확정
}
```

### Estructura de employee_contracts

```typescript
employeeContracts = {
  employeeId: UUID → employees
  type: 'INDEFINIDO' | 'DETERMINADO' | 'OBRA'
  startDate: timestamp
  endDate: timestamp | null  // null para indefinidos
  trialPeriodEnd: timestamp  // Art. 80 LOTTT
  weeklyHours: numeric(10,2).default('40')
  notes: string
  status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
}
```

---

## 3. Beneficios y Vacaciones (LOTTT)

### Vacaciones (Art. 189-197 LOTTT)

```typescript
employeeVacations = {
  year: integer
  totalDays: integer  // 15 + 1 por año (máximo 30)
  daysTaken: integer
  daysPending: integer
  status: 'PENDING' | 'TAKEN' | 'PAID'
  
  // Fechas
  startDate: timestamp
  endDate: timestamp
  returnDate: timestamp
  
  // Pago
  amount: numeric  // Bono vacacional
  paymentDate: timestamp
}
```

### Cálculo de Vacaciones

```
Días de disfrute = 15 días base + 1 día por cada año completo
Máximo = 30 días

Bono Vacacional = (salario integral / 30) × días
```

### Utilidades (Art. 142 LOTTT)

```typescript
employeeProfitSharing = {
  year: integer
  daysToPay: integer  // 15 días mínimo + días adicionales
  amount: numeric
  paymentDate: timestamp
  status: 'PENDING' | 'PAID'
}
```

### Cálculo de Utilidades

```typescript
// Artículo 142 LOTTT
// Mínimo 15 días por año

diasAntiguedad = (fechaFin - fechaIngreso) / 365
utilidades = salario * dias / 360 * 15
// O más días si aplica
```

---

## 4. Nómina - Conceptos y Cálculos

### payroll_item_lines - Categorías

| Category | Descripción | Ejemplos |
|----------|-------------|----------|
| INCOME | Ingresos | SALARY, BONUS, CESTATICKET |
| DEDUCTION | Deducciones empleado | SSO_EMP, FAOV_EMP, PIE_EMP |
| EMPLOYER | Cargas patronales | SSO_PAT, FAOV_PAT, PIE_PAT |

### Conceptos Típicos

| Code | Name | Category | Rate/Amount |
|------|------|----------|-------------|
| SALARY | Salario del Período | INCOME | varies |
| CESTATICKET | Ticket Alimentación | INCOME | FIXED_USD |
| EXTRA_HOUR | Horas Extra | INCOME | varies |
| SSO_EMP | Seguro Social Empleado | DEDUCTION | 4% |
| SSO_PAT | Seguro Social Patronal | EMPLOYER | 9-11% |
| FAOV_EMP | FAOV Empleado | DEDUCTION | 1% |
| FAOV_PAT | FAOV Patronal | EMPLOYER | 2% |
| PIE_EMP | RPE Empleado | DEDUCTION | 0.5% |
| PIE_PAT | RPE Patronal | EMPLOYER | 2% |

### Cálculos Típicos

```typescript
// Ejemplo: Empleado con salario $500 USD mensual

// INGRESOS
salary = 500.00
cestaticket = 40.00  // Valor mensual

// DEDUCCIONES EMPLEADO
ssoEmp = 500 * 0.04 = 20.00      // 4%
faovEmp = 500 * 0.01 = 5.00      // 1%
pieEmp = 500 * 0.005 = 2.50      // 0.5%

totalDeducciones = 20 + 5 + 2.50 = 27.50

// CARGAS PATRONALES
ssoPat = 500 * 0.10 = 50.00      // 10% (ejemplo)
faovPat = 500 * 0.02 = 10.00     // 2%
piePat = 500 * 0.02 = 10.00      // 2%

totalPatronales = 50 + 10 + 10 = 70.00

// NETO A PAGAR
neto = 500 + 40 - 27.50 = 512.50 USD
```

---

## 5. Estructura de payroll_runs

```typescript
payrollRuns = {
  code: string,           // "NOM-2024-01-15"
  branchId: UUID → branches
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  currencyId: UUID → currencies
  
  startDate: timestamp
  endDate: timestamp
  
  totalAmount: numeric(20,2).default('0')  // Total de la corrida
  status: 'DRAFT' | 'PAID'
}
```

### Flujo de Nómina

```
┌─────────┐     GENERATE      ┌─────────┐     PAY     ┌─────────┐
│  DRAFT  │ ──────────────→  │  PAID   │ ────────→ │ (paid)  │
└─────────┘                  └─────────┘            └─────────┘
     │
     │ CANCEL
     ▼
┌─────────┐
│ CANCELLED │
└─────────┘
```

---

## 6. Incidencias

### payroll_concept_types

```typescript
payrollConceptTypes = {
  code: string,    // "EXTRA_HOUR", "LATE", "BONUS"
  name: string,
  category: 'INCOME' | 'DEDUCTION'
  isSystem: boolean,  // true para conceptos sistema (no borrar)
}
```

### payroll_incidents

```typescript
payrollIncidents = {
  employeeId: UUID → employees
  conceptId: UUID → payroll_concept_types
  date: timestamp
  quantity: numeric(10,2).default('1')  // ej. 2 horas extra
  amount: numeric(20,2)  // Override o resultado
  status: 'PENDING' | 'PROCESSED'
  processedInRunId: UUID → payroll_runs
}
```

### Flujo de Incidencias

```
1. Se registra incidencia (PENDING)
2. Al generar nómina (DRAFT):
   - Busca incidencias en rango de fechas
   - Las suma al cálculo
   - Las marca como PROCESSED
3. Si se cancela corrida, se revierten a PENDING
```

---

## 7. Configuraciones de Nómina

### payroll_settings

```typescript
payrollSettings = {
  key: string,     // "CESTATICKET_USD", "SSO_EMP", "FAOV_PAT"
  label: string,   // "Cestaticket Socialista"
  value: numeric(20,4),  // Tasa o monto fijo
  type: 'FIXED_USD' | 'PERCENTAGE' | 'FIXED_VES'
  branchId: UUID → branches  // null = global
  isActive: boolean
}
```

### Configuraciones Típicas

| Key | Label | Value | Type |
|-----|-------|-------|------|
| CESTATICKET_USD | Cestaticket USD | 40.00 | FIXED_USD |
| SSO_EMP | SSO Empleado | 4 | PERCENTAGE |
| SSO_PAT | SSO Patronal | 10 | PERCENTAGE |
| FAOV_EMP | FAOV Empleado | 1 | PERCENTAGE |
| FAOV_PAT | FAOV Patronal | 2 | PERCENTAGE |
| PIE_EMP | PIE Empleado | 0.5 | PERCENTAGE |
| PIE_PAT | PIE Patronal | 2 | PERCENTAGE |

---

## 8. Generación de Nómina

### PayrollService.generate()

```typescript
async generate(data) {
  // 1. Obtener empleados activos de la branch
  const employees = await getActiveEmployees(data.branchId);
  
  // 2. Para cada empleado:
  for (const emp of employees) {
    // a) Obtener salary del período
    const baseAmount = emp.baseSalary / frequency.divisor;
    
    // b) Buscar incidencias en rango de fechas
    const incidents = await getIncidents(emp.id, startDate, endDate);
    
    // c) Calcular conceptos
    const lines = [];
    
    // INGRESOS
    lines.push({ code: 'SALARY', amount: baseAmount, category: 'INCOME' });
    lines.push({ code: 'CESTATICKET', amount: getSetting('CESTATICKET_USD'), category: 'INCOME' });
    
    // INCIDENCIAS
    for (const inc of incidents) {
      lines.push({ code: inc.concept.code, amount: inc.amount, category: inc.concept.category });
    }
    
    // DEDUCCIONES EMPLEADO
    lines.push({ code: 'SSO_EMP', base: baseAmount, rate: 0.04, amount: baseAmount * 0.04 });
    lines.push({ code: 'FAOV_EMP', base: baseAmount, rate: 0.01, amount: baseAmount * 0.01 });
    lines.push({ code: 'PIE_EMP', base: baseAmount, rate: 0.005, amount: baseAmount * 0.005 });
    
    // d) Calcular neto
    const netTotal = lines.filter(l => l.category === 'INCOME').reduce((s, l) => s + l.amount, 0)
                - lines.filter(l => l.category === 'DEDUCTION').reduce((s, l) => s + l.amount, 0);
    
    // e) Guardar payroll_item + lines
    await createPayrollItem(runId, emp.id, baseAmount, bonuses, deductions, netTotal, lines);
  }
  
  // 3. Actualizar totalAmount de run
  await updateTotalAmount(runId);
}
```

---

## 9. Procesamiento de Pagos

### PayrollService.processPayment()

```typescript
async processPayment(id, data) {
  // 1. Obtener corrida
  const run = await getPayrollRun(id);
  
  // 2. Validar saldo en cuenta empresa
  const account = await getBankAccount(data.bankAccountId);
  if (account.currentBalance < run.totalAmount) {
    throw new Error('Saldo insuficiente');
  }
  
  // 3. Transacción:
  // a) Debitar cuenta empresa
  await updateBalance(data.bankAccountId, -run.totalAmount);
  
  // b) Crear accounting entry
  await createPayrollEntry(run);
  
  // c) Generar archivo TXT para banco
  const txt = await bankFileGenerator.generateStandardTxt(run.id);
  
  // d) Marcar corrida como PAID
  await updateStatus(run.id, 'PAID');
}
```

### BankFileGenerator.generateStandardTxt()

```typescript
generateStandardTxt(runId) {
  // Formato típico para bancos venezolanos:
  // Tipo registro | Cuenta | Monto | Referencia | ...
  
  // Ejemplo:
  // 0210123456789012345678900000015000000000051250  // 16+22+10+10 = 58 chars
}
```

---

## 10. Archivo TXT Banco

### Formato Típico

```txt
01  02012345678901  0123456789  0000005125  N12345678  EMPLEADO 1                     000000500000
02  02012345678902  0123456789  0000003500  N12345679  EMPLEADO 2                     000000350000
...
99  00000000000000  0000000000  0000015000  00000000  TOTAL NOMINA
```

### Campos

| Posición | Campo | Descripción |
|----------|-------|-------------|
| 1-2 | Tipo Registro | 01=Detalle, 99=Total |
| 3-22 | Cuenta Destino | Número de cuenta del empleado |
| 23-34 | Referencia | Código del banco o identificación |
| 35-44 | Monto | Monto en centavos o decimales |
| 45-58 | Nombre | Nombre del empleado |
| 59-68 | Total | Acumulado |

---

## 11. Banco: Catálogo SUDEBAN

### banks (Catálogo Maestro)

```typescript
banks = {
  name: string,   // "Banesco", "Mercantil"
  code: string,   // "0134", "0105" (código SUDEBAN)
  isActive: boolean
}
```

### Códigos SUDEBAN Comunes

| Código | Banco |
|--------|-------|
| 0102 | Banco de Venezuela |
| 0104 | Banesco |
| 0105 | Mercantil |
| 0114 | Provincial |
| 0134 | Banesco (otras veces) |
| 0163 | Banco del Tesoro |
| 0172 | Bicentenario |

---

## 12. Compliance Reports

### FAOV

```typescript
generateFaovTxt(runId) {
  // Genera archivo para FAOV
  // Employees que cotizan: employees con payroll deductions FAOV
  // Base: salary + bonuses
  // Employee: 1% del total
  // Employer: 2% del total
}
```

### ARI Estimation

```typescript
generateAriEstimation(runId) {
  // Estimación ARI (Administradora de Riesgos Laborales)
  // обычно 0.5% - 2% depending on risk level
}
```

---

## 13. Liquidación de Empleado

### terminations.calculate()

```typescript
calculateTermination(employeeId, reason) {
  // 1. Obtener datos del empleado
  const emp = getEmployee(employeeId);
  
  // 2. Calcular antigüedad en días
  const antiguedadDias = (today - emp.hireDate) / (1000 * 60 * 60 * 24);
  
  // 3. Prestaciones (Art. 142 LOTTT)
  const utilidades = calcularUtilidades(emp);
  
  // 4. Vacaciones no tomadas
  const vacaciones = calcularVacacionesDebidas(emp);
  
  // 5. Preaviso (si aplica)
  const preaviso = calcularPreaviso(emp, reason);
  
  // 6. Total liquidación
  return {
    utilidades,
    vacaciones,
    preaviso,
    total: utilidades + vacaciones + preaviso
  };
}
```

---

## 14. Beneficios (Bono Vacacional)

### employee_benefits

```typescript
employeeBenefits = {
  employeeId: UUID
  year: integer
  month: integer
  monthlySalary: numeric
  integralSalary: numeric  // Salario + cestaticket
  days: integer           // Días de beneficio
  amount: numeric        // Monto a pagar
  accumulatedAmount: numeric  // Acumulado históricamente
  type: 'REGULAR' | 'ANTICIPO' | 'LIQUIDACION'
  paid: boolean
  paymentDate: timestamp
}
```

### Cálculo

```typescript
// Integral salary = salary + cestaticket
integralSalary = baseSalary + cestaticket

// Bono = (integral / 30) * dias
bonoVacacional = integralSalary / 30 * days
```
