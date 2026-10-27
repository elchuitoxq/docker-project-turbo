# Pendientes abiertos (estado final)

Todos los ítems `P-00` … `P-17` están **resueltos**. El detalle con evidencia está en
[`11-FASE-8-PENDIENTES.md`](./11-FASE-8-PENDIENTES.md).

Lo que queda abierto es **mejora incremental**, no deuda pendiente de la iteración.

## ✅ Resueltos en la última pasada

| ID     | Tema                     | Evidencia                                                                                                                                                                       |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P-16` | Entrega de correo real   | `nodemailer` + `SMTP_URL` + `MAIL_FROM`. Verificado con **Mailpit**: correo recibido, token extraído del cuerpo y `reset` `200`; en producción la API **no** devuelve el enlace |
| `P-17` | Página `/reset-password` | Formulario con validación, estados de éxito/error, i18n `es-VE`/`en-US` y E2E (2 tests)                                                                                         |

## 🟡 Calidad / mejoras incrementales

| ID     | Tema                                     | Detalle                                                                                              |
| ------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `P-18` | 7 warnings `react-hooks/exhaustive-deps` | Preexistentes y cosméticos; las tres reglas críticas están en `error`.                               |
| `P-19` | `shared-types` publica fuente `.ts`      | `main`/`types` apuntan a `src/index.ts`; funciona con `transpilePackages`.                           |
| `P-20` | Subir umbrales de cobertura              | Hoy son de **no-regresión** (backend 65/50/68/66 · frontend 47/48/44/50 · database 80/65/60/78).     |
| `P-21` | Validar `--affected` en un PR real       | Configuración lista (`fetch-depth: 0` + `git fetch` del base).                                       |
| `P-22` | Primer run del job `e2e` en CI           | Bloqueante y 7/7 en local contra build de producción; falta confirmarlo en GitHub Actions.           |
| `P-23` | Página de "solicitar reset"              | El enlace se envía por correo, pero no hay formulario público de "olvidé mi contraseña" en el login. |
| `P-24` | `next-env.d.ts` en el repo               | Next lo reescribe en cada build; trackeado y excluido de `format:check`.                             |

## ⏳ Requiere validación externa (bloqueante para E2)

| ID     | Tema                                   | Detalle                                                                                                                                                                                                                                                                          |
| ------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P-28` | Reglas LOTTT a validar antes del motor | [`docs/09-HR-NOMINA-VENEZUELA.md`](../09-HR-NOMINA-VENEZUELA.md) §15: alícuotas y topes de IVSS/paro forzoso/FAOV, monto de cestaticket, tope de utilidades, tabla de ISLR. **Requiere contador o abogado laboral**; no se puede sustituir con tests. Bloquea T-02-03 y T-02-04. |

## 🗄️ Riesgos aceptados (sin acción prevista)

| ID     | Tema                                              | Motivo                                                                                             |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `P-25` | `postman-collection` fija `@faker-js/faker@5.5.3` | Se usa solo vía `pnpm dlx` (fuera del árbol auditado); no hay parche upstream.                     |
| `P-26` | Swagger accesible en desarrollo                   | Intencional para DX; en producción requiere `ENABLE_SWAGGER=true`.                                 |
| `P-27` | Token en memoria del store (no persistido)        | El JWT ya no toca `localStorage`; vive en la cookie httpOnly y en memoria hasta el próximo reload. |

## Cómo verificar que no hay regresiones

```powershell
pnpm install --frozen-lockfile
pnpm audit                      # 0 vulnerabilidades
pnpm format:check
pnpm turbo run lint typecheck build test:coverage
docker compose ps               # backend/frontend/postgres healthy
pnpm exec playwright test       # 7/7
```
