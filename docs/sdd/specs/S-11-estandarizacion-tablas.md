# S-11 — Estandarización de tablas de listado

| Campo          | Valor                                                             |
| -------------- | ----------------------------------------------------------------- |
| **Estado**     | 🟢 Entregada (F1…F3)                                              |
| **Prioridad**  | 🟡 P2 — deuda visual: siete tablas equivalentes con siete estilos |
| **Depende de** | S-09 (moneda visible), S-10 (listados enlazan a la ficha)         |
| **Épica**      | E11                                                               |
| **Origen**     | Revisión del 2026-10-30: "las tablas poseen estilos diferentes"   |

---

## 1. Problema

Los siete listados operativos —Clientes y proveedores, Productos, Stock, Pedidos, Ventas, Compras y
Facturación— resuelven lo mismo (una consulta paginada, un esqueleto de carga y un estado vacío) con
**siete implementaciones distintas**. El usuario percibe saltos al navegar entre pantallas:

| Aspecto    | Antes                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| Contenedor | dos vistas usaban `div.rounded-md.border` sin cabecera; el resto `Card` + `CardHeader pb-3`               |
| Conteo     | en el subtítulo de la página, en la descripción de la tarjeta, o en ninguno                               |
| Carga      | filas esqueleto dentro de la tabla **o** una pila de `<Skeleton>` encima, perdiendo el encabezado         |
| Vacío      | fila `colSpan` **o** bloque `p-6`/`p-8`/`p-10`, con y sin icono                                           |
| Números    | `text-right`, `text-right tabular-nums` o sin alinear; montos sin moneda (`toFixed(2)`)                   |
| Códigos    | monoespaciado en unas vistas, proporcional en otras                                                       |
| Acciones   | `DropdownMenu` duplicado en cada vista, con iconos y etiquetas distintas                                  |
| Filtros    | `<select>` nativo en Ventas vs. `Select` de shadcn en el resto; anchos `w-45`/`w-48`, padding `p-3`/`p-4` |
| Responsive | columnas secundarias ocultas con `hidden md:table-cell` sólo en dos vistas                                |

## 2. Alcance

1. **Primitivos compartidos** en `apps/frontend/components/list/list-table.tsx`.
2. **Refactor de las siete vistas** para consumirlos, sin cambiar datos, permisos ni rutas.
3. **Corrección de defectos colaterales** detectados al refactorizar (importe de crédito sin moneda).
4. **Documentación** del invariante para que las tablas nuevas nazcan alineadas.

## 3. Diseño

Un único fichero declara las piezas; las vistas sólo describen sus columnas.

| Pieza              | Responsabilidad                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `ListCard`         | `Card` con `CardHeader` (título, descripción/conteo, slot `actions`) y `CardContent` sin padding |
| `ListFilters`      | `Card` con `p-3` y fila `flex-col sm:flex-row` para buscador + selectores                        |
| `ListTh`           | encabezado con `align` y `hide` (`sm`/`md`/`lg`) declarativos                                    |
| `ListTd`           | celda con `numeric` (derecha + `tabular-nums`), `mono` (códigos), `muted`, `hide` y alto fijo    |
| `ListSkeletonRows` | filas de carga que **conservan el encabezado**                                                   |
| `ListEmptyRow`     | fila vacía `py-10` con mensaje y pista, sin reemplazar la tabla                                  |
| `ListRowActions`   | disparador único de acciones de fila (icono `MoreHorizontal`, `aria-label`)                      |

**Invariante:** todo listado usa `ListCard` + `ListFilters` (si hay filtros) + `ListTh`/`ListTd` +
`ListSkeletonRows`/`ListEmptyRow`, y `ListRowActions` para el menú de fila. Las alturas de fila quedan
uniformes (`52 px`) porque `ListTd` fija el mínimo: las tablas con y sin acciones ya no "saltan".

Las vistas conservan `Table`/`TableBody`/`TableHeader`/`TableRow` reexportados por el módulo, de modo que
no quedan dos orígenes de importación.

## 4. Tareas

| ID      | Tarea                                                                         | Artefactos                                                   | Verificación                              | Talla | Estado |
| ------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------- | ----- | ------ |
| T-11-01 | Primitivos `ListCard`, `ListTh`, `ListTd`, `ListSkeletonRows`, `ListEmptyRow` | `components/list/list-table.tsx`                             | typecheck y uso en las siete vistas       | M     | ✅     |
| T-11-02 | `ListRowActions` y `ListFilters` (menú y barra de filtros únicos)             | `components/list/list-table.tsx`                             | selects de 192×36 px en las cinco vistas  | S     | ✅     |
| T-11-03 | Clientes y proveedores + Productos                                            | `partners-table.tsx`, `products-view.tsx`                    | mismo contenedor y acciones               | M     | ✅     |
| T-11-04 | Pedidos, Ventas y Compras                                                     | `orders-view.tsx`, `invoices-view.tsx`, `purchases-view.tsx` | filas de 52 px y menú uniforme            | M     | ✅     |
| T-11-05 | Stock y Facturación                                                           | `stock-view.tsx`, `finance/components/invoices-view.tsx`     | columnas responsive comunes               | M     | ✅     |
| T-11-06 | Verificación visual de las siete rutas y de las columnas responsive           | navegador (MANAGER)                                          | 52 px de alto de fila en las siete vistas | S     | ✅     |
| T-11-07 | Riesgo de regresión en tests de UI                                            | `pnpm --filter frontend test`                                | 340 pruebas verdes                        | S     | ✅     |

## 5. Decisiones

- **No** se introduce una librería de tablas (TanStack Table): el coste de migrar siete vistas con
  columnas distintas no se justifica; el problema era de estilos, no de comportamiento.
- El conteo se deja en la **descripción de la tarjeta** (`ListCard`) porque es lo único que se ve en las
  siete pantallas; el subtítulo de la página queda para el contexto del módulo.
- `ListTd` fija `h-[52px]`: es el alto de un botón `size="icon"` (36 px) más el padding de celda (8 px
  arriba y abajo), así las filas con acciones y sin ellas miden lo mismo.
- El importe del límite de crédito de Clientes y proveedores pasó de `toFixed(2)` a
  `formatMoney(valor, baseCode)`: era el último monto sin moneda de un listado.
- Las vistas con alternancia tabla/tarjetas (Clientes y proveedores, Productos) devuelven la **misma**
  `ListCard` en ambos modos: el título y el conteo no desaparecen al cambiar de vista, el modo tarjetas
  usa una rejilla `sm:grid-cols-2` con `p-4` y la tabla no muestra encabezados de columna encima de las
  tarjetas.

## 6. Verificación

| Comprobación                         | Resultado                                                         |
| ------------------------------------ | ----------------------------------------------------------------- |
| Alto de fila en las siete vistas     | 52 px (53 px con borde) en todas                                  |
| Encabezado de columna                | 40 px en todas                                                    |
| Selectores de filtro                 | 192×36 px, shadcn `Select`; cero `<select>` nativos               |
| Columnas responsive (`hide`)         | `Moneda` desaparece a 900 px, `Vence` se mantiene                 |
| Estados de carga/vacío               | esqueleto y vacío dentro de la tabla, con encabezado visible      |
| Modo tarjetas (Clientes y Productos) | rejilla de 2 columnas dentro de la misma tarjeta, sin encabezados |
| `pnpm --filter frontend exec tsc`    | sin errores                                                       |
| `pnpm --filter frontend lint`        | 0 errores, 7 avisos preexistentes                                 |
| `pnpm --filter frontend test`        | 340 pruebas verdes                                                |

**Gate de salida E11:** las siete pantallas comparten contenedor, cabecera, fila y menú de acciones; no
quedan `<select>` nativos ni montos sin moneda en los listados; y las filas mantienen el mismo ritmo
vertical con y sin acciones.
