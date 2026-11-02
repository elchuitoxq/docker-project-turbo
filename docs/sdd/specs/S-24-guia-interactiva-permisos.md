# S-24 — Guía interactiva de procesos por permisos

| Campo      | Valor                          |
| ---------- | ------------------------------ |
| Estado     | Implementado                   |
| Prioridad  | P1                             |
| Alcance    | `apps/frontend` (guías, menú)  |
| Depende de | S-00 (RBAC), S-11 (primitivos) |
| Fecha      | 2026-10-31                     |

## 1. Contexto

El sistema ya expone 38 submódulos repartidos en cinco áreas (Inventario, Operaciones, Finanzas,
RRHH y Configuración), pero **el usuario sólo descubre qué puede hacer probando**. Cuando una acción
no aparece, no hay forma de saber si falta un permiso, si el documento está en otro estado o si el
proceso simplemente no existe.

La respuesta no es un manual en PDF: es una guía dentro del producto que **lea los mismos permisos
que aplica el guard** y explique, pantalla por pantalla, qué habilita cada uno.

## 2. Qué se implementó

### 2.1 Rutas

| Ruta                         | Pantalla                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| `/dashboard/guides`          | Índice con buscador global y estado por módulo                           |
| `/dashboard/guides/[module]` | Guía del módulo (`inventory`, `operations`, `finance`, `hr`, `settings`) |

Se enlazan desde el grupo **Guías de uso** del menú lateral. El grupo **no** se filtra por permisos
de módulo: precisamente sirve para explicar lo que el usuario todavía no puede hacer. La guía se
adapta al permiso efectivo en lugar de ocultarse.

### 2.2 Contenido data-driven

- `lib/guides/types.ts` — contrato (`GuideModule`, `GuideSubmodule`, `GuideAction`).
- `lib/guides/modules/*.ts` — un archivo por área con sus submódulos.
- `lib/guides/registry.ts` — agrega los cinco módulos; única fuente de verdad del contenido.

Cada submódulo declara: permiso de entrada, acciones con su código de permiso, paso a paso, reglas de
negocio, errores frecuentes y, cuando aplica, advertencia de acción irreversible. **Ningún permiso se
escribe a mano**: se referencia `PERMISSIONS` de `lib/permissions.ts`, así que un código inexistente
no compila y el test de catálogo lo detecta.

### 2.3 Interactividad

| Elemento               | Comportamiento                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Simulador de permisos  | Selecciona un rol por defecto o marca permisos sueltos; el resto de la guía se recalcula |
| Matriz rol × submódulo | Nivel de acceso (`Completo` / `Parcial` / `—`) para los seis roles del sistema           |
| Buscador               | Filtra por título, paso, regla o código de permiso, dentro del módulo y global           |
| Índice con anclas      | Enlaces `#submodulo`, con punto de color según el acceso real                            |
| Progreso de lectura    | Marca de «revisado» por submódulo, persistida en `localStorage`                          |

Reglas de cálculo (puras, en `lib/guides/access.ts`):

- `none` — falta el permiso de entrada.
- `partial` — entra, pero le falta alguna acción del flujo.
- `full` — entra y puede ejecutar todas las acciones documentadas.

### 2.4 Acceso desde cualquier pantalla

La guía no se alcanza sólo por el menú: el botón de ayuda del encabezado (`LifeBuoy`) resuelve la
ruta activa con `lib/guides/links.ts` y ofrece **«Ver permisos y paso a paso»**, que abre la guía del
submódulo correspondiente con ancla (`/dashboard/guides/finance#invoices`). En fichas de detalle gana
el `href` más largo que sea prefijo, así que `/dashboard/finance/invoices/<id>` lleva a la misma
sección. Si la pantalla no está documentada, el popover explica que no hay guía y enlaza al índice.

### 2.5 Progreso sin renders en cascada

`lib/guides/progress-store.ts` expone el progreso como store externo consumido con
`useSyncExternalStore`: leer `localStorage` dentro de un efecto provocaba un `setState` sincrónico
(regla `react-hooks/set-state-in-effect`) y un render adicional por visita.

## 3. Cómo mantener la guía

1. Al agregar o cambiar un permiso en `packages/database/src/scripts/seed-rbac.ts` y en
   `apps/frontend/lib/permissions.ts`, actualiza el submódulo correspondiente en
   `lib/guides/modules/`.
2. Al crear una pantalla nueva, agrega su entrada en el registry y en `lib/navigation.ts`.
3. Si cambia el rol por defecto de un rol del sistema, ajusta `lib/guides/roles.ts` (espejo de
   `ROLE_PERMISSIONS`).

## 4. Verificación

| Comprobación                                                                    | Resultado             |
| ------------------------------------------------------------------------------- | --------------------- |
| `pnpm --filter frontend typecheck`                                              | Sin errores           |
| `pnpm --filter frontend exec eslint components/guides lib/guides`               | Sin errores           |
| `pnpm --filter frontend vitest run lib/guides components/guides lib/navigation` | 36 pruebas            |
| `pnpm --filter frontend build`                                                  | Rutas prerenderizadas |

Las pruebas cubren: catálogo de permisos real, niveles de acceso, matriz por rol, búsqueda, progreso
(tolerante a datos corruptos), resolución del enlace contextual (pantalla exacta, ficha de detalle,
ruta más específica y módulo sin guía) y el render interactivo (bloqueo, habilitación por simulador,
marcado de revisado y filtrado por búsqueda).
