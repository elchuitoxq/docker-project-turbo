# S-13 — Controles de fecha unificados

| Campo          | Valor                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------- |
| **Estado**     | 🟢 Entregada                                                                                        |
| **Prioridad**  | 🟡 P2 — coherencia visual y de comportamiento entre 15 pantallas                                    |
| **Depende de** | S-11 (primitivos de UI), S-10 (fichas)                                                              |
| **Épica**      | E13                                                                                                 |
| **Origen**     | Revisión del 2026-10-31: "hay muchos input de tipo date que deberían usar el Date Picker de shadcn" |

---

## 1. Problema

Quince pantallas usaban `<input type="date">` nativo. El control no se parece al resto del sistema y su
comportamiento depende del navegador:

- El texto se muestra en `dd-mm-aaaa` (no `dd/mm/aaaa`), sin máscara y con un icono que no sigue el tema.
- No hay selector: para una fecha lejana hay que escribirla a mano o usar las flechas del teclado.
- En los filtros de rango ("desde"/"hasta") no se puede impedir elegir un "hasta" anterior al "desde".
- En los formularios que se envían con `FormData` el valor viaja como `YYYY-MM-DD`, pero el usuario ve
  otro formato: lo que se escribe no es lo que se lee.

## 2. Alcance

1. **Componente único** `DatePicker` sobre `Popover` + `Calendar` (shadcn), con valor `YYYY-MM-DD`.
2. **Sustituir las 27 apariciones** de `<input type="date">` en 15 archivos.
3. **Soportar los dos modos** que ya existían: controlado (estado de React) y no controlado (formularios
   con `FormData`).
4. **Rangos coherentes**: el "hasta" no permite fechas anteriores al "desde" y viceversa.

## 3. Diseño

### 3.1 Componente

`components/ui/date-picker.tsx`:

| Prop                  | Para qué                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| `value`               | Modo controlado (`YYYY-MM-DD`).                                             |
| `defaultValue`        | Modo no controlado: el control guarda su fecha y la publica en un `hidden`. |
| `onChange`            | Devuelve `YYYY-MM-DD` (o `''` al limpiar).                                  |
| `name`                | Renderiza `<input type="hidden">` para los formularios con `FormData`.      |
| `fromDate` / `toDate` | Rango seleccionable: bloquea días fuera del intervalo.                      |
| `clearable`           | Acción "Limpiar" cuando hay fecha (filtros y campos opcionales).            |

Se añadió el `Calendar` de shadcn (con `react-day-picker`) en español (`date-fns/locale/es`), semana
iniciando en lunes y los iconos de `lucide-react` que ya usa el proyecto.

**Formato y zona horaria**: el valor se guarda como `YYYY-MM-DD` y la fecha se construye con
`new Date(año, mes-1, día)`. `new Date('2026-10-27')` es medianoche UTC: en Venezuela mostraría el día
anterior. `parseDay`/`toDayValue` están exportados y cubiertos por pruebas.

**Formularios con `FormData`** (nómina, asientos contables, vacaciones y liquidación de empleados,
parámetros de nómina): el `hidden` mantiene el mismo nombre de campo, así que no cambió ningún
controlador. Como un `hidden` no participa en la validación nativa, la obligatoriedad del período de
nómina se valida en el `onSubmit` con un mensaje explícito.

### 3.2 Dónde se aplicó

| Pantalla                                                                                                                     | Uso                                |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Auditoría, Reportes fiscales, Conciliación, Estado de cuenta, Retenciones, Asientos, Períodos                                | rango desde/hasta                  |
| Facturación (vencimiento), Pedidos (fecha), Préstamos (vencimiento), Cierre diario, Monedas (vigencia), Parámetros de nómina | fecha única                        |
| Nómina (período), Asientos (fecha del asiento), Empleados (vacaciones y egreso)                                              | fecha en formulario con `FormData` |

## 4. Tareas

| ID      | Tarea                                                           | Artefactos                                                                    | Verificación                                 | Talla | Estado |
| ------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- | ----- | ------ |
| T-13-01 | Añadir `Calendar` (shadcn) y crear `DatePicker`                 | `components/ui/calendar.tsx`, `components/ui/date-picker.tsx`                 | calendario en español y valor `YYYY-MM-DD`   | M     | ✅     |
| T-13-02 | Modo no controlado + `hidden` para `FormData`                   | `date-picker.tsx`, `payroll-view`, `entries`, `employees`, `payroll-settings` | nómina y asiento guardan la fecha elegida    | S     | ✅     |
| T-13-03 | Sustituir los `input type="date"` de filtros y formularios      | 15 archivos (ver §3.2)                                                        | no queda ningún `type="date"`                | M     | ✅     |
| T-13-04 | Rangos coherentes y acción "Limpiar"                            | `fromDate`/`toDate`, `clearable`                                              | el "hasta" no acepta días previos al "desde" | S     | ✅     |
| T-13-05 | Validación del período de nómina al perder el `required` nativo | `payroll-view.tsx`                                                            | sin fechas no se genera la nómina            | S     | ✅     |
| T-13-06 | Pruebas del control                                             | `components/ui/date-picker.test.tsx`                                          | 6 pruebas                                    | S     | ✅     |

## 5. Decisiones

- **Un solo control para los dos modos.** Duplicar (`DatePicker` controlado + `DateInput` para
  formularios) habría dejado dos estilos distintos, que es justo lo que se quería eliminar.
- **El valor sigue siendo `YYYY-MM-DD`.** Los filtros, los contratos del API y las comparaciones de
  fechas no cambiaron: sólo cambió cómo se elige y cómo se muestra.
- **Se conserva el `Calendar` de shadcn sin retocar estilos.** El componente nuevo ajusta el tema por
  tokens; cualquier cambio de color se haría en `globals.css`, no en el componente.
- **El campo de vencimiento no bloquea fechas pasadas**: registrar una factura ya vencida es un caso
  real (compra atrasada), y bloquearlo daba la impresión de que el control estaba roto.

## 6. Verificación

| Comprobación                                  | Resultado                                                         |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `<input type="date">` restantes               | 0 (sólo se mencionan en la documentación del componente)          |
| Calendario en español                         | "octubre 2026", semana de lunes a domingo                         |
| Selección de un día                           | el botón muestra `15/10/2026` y el `hidden` queda en `2026-10-15` |
| Rango desde/hasta                             | el "hasta" bloquea los días previos al "desde"                    |
| Formulario con `FormData`                     | la nómina recibe `startDate`/`endDate` del control                |
| Pruebas                                       | 6 nuevas (valor, placeholder, selección, `hidden`, zona horaria)  |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | 6/6 · 0 errores · 4/4                                             |

Evidencia: [2026-10-31-date-picker.png](../../qa/evidencias/manager/2026-10-31-date-picker.png).

**Gate de salida E13:** toda fecha del sistema se elige con el mismo control, en español y con el mismo
formato de lectura; los formularios siguen enviando `YYYY-MM-DD` sin cambios en el backend.
