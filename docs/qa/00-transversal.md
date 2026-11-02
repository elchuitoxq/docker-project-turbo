# Casos transversales (CT)

Casos que aplican a **todos** los roles del alcance. Se ejecutan una vez por rol salvo que se
indique lo contrario. Precondición general: stack levantado y datos semilla cargados
(ver [README](./README.md#2-entorno-y-puesta-en-marcha)).

| #     | Caso                               | Pasos                                                                                                                                                              | Resultado esperado                                                                                                                                                                                                             |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CT-01 | Acceso sin sesión                  | Abrir `http://localhost:3000/dashboard` en ventana privada.                                                                                                        | Redirige a `/login`. No se muestra ningún dato del panel.                                                                                                                                                                      |
| CT-02 | Inicio de sesión por rol           | En `/login`, ingresar correo y `Test1234!` del rol.                                                                                                                | Redirige a `/dashboard`, se muestra brevemente "Cargando…" y luego el Panel con los KPIs, el gráfico y la actividad reciente. Los textos deben estar en Español (VE) (ver idioma en el [README](./README.md#21-credenciales)). |
| CT-03 | Credenciales inválidas             | Correo válido + contraseña `incorrecta`.                                                                                                                           | Mensaje de error genérico ("Credenciales inválidas" o similar). No revela si el correo existe. Sin traza técnica.                                                                                                              |
| CT-04 | Recuperar contraseña               | En `/login` → "¿Olvidaste tu contraseña?" → enviar correo existente.                                                                                               | Mensaje genérico de envío, sin confirmar existencia de la cuenta.                                                                                                                                                              |
| CT-05 | Menú por rol                       | Con la sesión del rol, recorrer el sidebar completo (grupos y subítems).                                                                                           | Coincide **exactamente** con la columna del rol en la [matriz RBAC](./README.md#3-matriz-rbac-esperada-menú-por-rol). Ni ítems de más ni de menos.                                                                             |
| CT-06 | Rutas fuera de permiso             | Escribir en la barra de direcciones una ruta que el rol no debe ver (p. ej. MANAGER → `/dashboard/finance/retentions`; WAREHOUSE → `/dashboard/finance/treasury`). | Redirige a `/forbidden?reason=no-permission` con mensaje claro y opción de volver al Panel. Nunca renderiza la vista.                                                                                                          |
| CT-07 | Persistencia de sesión             | Con sesión activa, recargar con F5 y abrir una nueva pestaña en `/dashboard`.                                                                                      | Mantiene la sesión (cookie httpOnly + store), no vuelve al login y los permisos coinciden con el rol.                                                                                                                          |
| CT-08 | Selector de empresa/sucursal       | En el sidebar, revisar los combos de Empresa y Sucursal.                                                                                                           | Se listan las empresas/sucursales asignadas (2 en el entorno actual), con `Test Branch` seleccionada por defecto. Al cambiar de sucursal los datos de la vista se recargan.                                                    |
| CT-09 | Aislamiento por sucursal           | Con `Test Branch` activa, anotar una factura (`INV-000001`) y un pedido (`ORD-000001`). Cambiar a la otra sucursal y volver a los listados.                        | En la otra sucursal no aparecen esos documentos. Al volver a `Test Branch` reaparecen.                                                                                                                                         |
| CT-10 | Cierre de sesión                   | Menú de usuario → "Cerrar sesión". Luego usar "Atrás" del navegador.                                                                                               | Vuelve a `/login`; el historial no muestra datos autenticados (se redirige al login).                                                                                                                                          |
| CT-11 | Enlaces del Panel según permisos   | En el Panel, pulsar cada tarjeta KPI.                                                                                                                              | Si el rol tiene el módulo, navega a la vista; si no lo tiene, debe caer en `/forbidden` o el enlace no debería mostrarse (ver hallazgo #9). Registrar qué ocurre por rol.                                                      |
| CT-12 | Guard de sesión expirada/ inválida | Borrar la cookie de sesión en DevTools (Application → Cookies) y navegar a otra vista del panel.                                                                   | Redirige a `/login` sin errores 5xx en consola y sin pantalla en blanco.                                                                                                                                                       |
| CT-13 | Responsive 375 px                  | Con DevTools en 375×812, recorrer Panel, listados y un formulario modal.                                                                                           | Sidebar colapsa a drawer; tablas hacen scroll horizontal sin romper layout; botones accesibles; sin solapamientos.                                                                                                             |
| CT-14 | Accesibilidad básica               | Con teclado: tabular por el sidebar, abrir un diálogo y cerrarlo con `Esc`; revisar `for`/`id` de un formulario.                                                   | Foco visible y orden lógico; diálogos atrapan el foco y se cierran con `Esc`; inputs con label asociado; sin errores de consola por accesibilidad.                                                                             |
| CT-15 | Consola sin errores                | Con DevTools → Console activa, recorrer las vistas del rol.                                                                                                        | Sin errores rojos de React/Next (warnings conocidos se anotan). Sin peticiones 401/403 inesperadas para vistas permitidas.                                                                                                     |

## Registro de ejecución

| #     | Rol        | Estado | Observación / evidencia |
| ----- | ---------- | ------ | ----------------------- |
| CT-01 | —          |        |                         |
| CT-02 | MANAGER    |        |                         |
| CT-02 | SELLER     |        |                         |
| CT-02 | WAREHOUSE  |        |                         |
| CT-02 | ACCOUNTANT |        |                         |
| CT-03 | —          |        |                         |
| CT-04 | —          |        |                         |
| CT-05 | MANAGER    |        |                         |
| CT-05 | SELLER     |        |                         |
| CT-05 | WAREHOUSE  |        |                         |
| CT-05 | ACCOUNTANT |        |                         |
| CT-06 | MANAGER    |        |                         |
| CT-06 | SELLER     |        |                         |
| CT-06 | WAREHOUSE  |        |                         |
| CT-06 | ACCOUNTANT |        |                         |
| CT-07 | —          |        |                         |
| CT-08 | —          |        |                         |
| CT-09 | —          |        |                         |
| CT-10 | —          |        |                         |
| CT-11 | MANAGER    |        |                         |
| CT-11 | SELLER     |        |                         |
| CT-11 | WAREHOUSE  |        |                         |
| CT-11 | ACCOUNTANT |        |                         |
| CT-12 | —          |        |                         |
| CT-13 | —          |        |                         |
| CT-14 | —          |        |                         |
| CT-15 | —          |        |                         |
