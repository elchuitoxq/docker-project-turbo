# Plantilla de ejecución y cierre

Copiar esta plantilla a `docs/qa/ejecuciones/<AAAA-MM-DD>-<rol>.md` por cada sesión de pruebas
(una por rol y día). No editar la plantilla original.

## 1. Datos de la sesión

| Campo               | Valor                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| Fecha               |                                                                            |
| Ejecutor            |                                                                            |
| Rol probado         | MANAGER / SELLER / WAREHOUSE / ACCOUNTANT                                  |
| Commit / rama       | `git rev-parse --short HEAD`                                               |
| Navegador y versión |                                                                            |
| Resolución(es)      | 1440×900 / 375×812                                                         |
| Entorno             | Docker local (`localhost:3000` + `localhost:4000`)                         |
| Datos reseñados     | Sí / No (`docker compose exec backend pnpm --filter database db:seed:dev`) |

## 2. Resumen por rol

| Rol              | Casos  | OK  | FALLA | BLOQ. | N/A |
| ---------------- | :----: | :-: | :---: | :---: | :-: |
| Transversal (CT) |   15   |     |       |       |     |
| MANAGER (MG)     |   24   |     |       |       |     |
| SELLER (SL)      |   14   |     |       |       |     |
| WAREHOUSE (WH)   |   12   |     |       |       |     |
| ACCOUNTANT (AC)  |   20   |     |       |       |     |
| **Total**        | **85** |     |       |       |     |

## 3. Bitácora de casos

Una fila por caso ejecutado. `Estado` ∈ OK / FALLA / BLOQ. / N/A.

| Caso  | Estado | Resultado observado | Evidencia | Defecto |
| ----- | ------ | ------------------- | --------- | ------- |
| CT-05 |        |                     |           |         |
| …     |        |                     |           |         |

## 4. Registro de defectos

| ID      | Caso | Severidad   | Título | Esperado vs. actual | Evidencia | Estado  |
| ------- | ---- | ----------- | ------ | ------------------- | --------- | ------- |
| DEF-001 |      | S1/S2/S3/S4 |        |                     |           | Abierto |

### Ficha de defecto (formato largo, si aplica)

```text
ID:            DEF-00X
Título:
Caso:          <ID del caso>
Rol:           <rol>
Severidad:     S1 | S2 | S3 | S4
Precondición:
Pasos:
  1.
  2.
Esperado:
Actual:
Evidencia:     docs/qa/evidencias/<rol>/...
Request/Response relevante (si es API):
Notas / hipótesis:
```

## 5. Hallazgos conocidos (no abrir duplicados)

Marcar como _conocido_ y referenciar el número de la tabla de
[README §6](./README.md#6-hallazgos-previos-a-confirmar-en-la-ejecución).
Si la ejecución confirma el hallazgo y **no** existe ticket, crear uno con la ficha de arriba.

## 6. Checklist de cierre

- [ ] `docker compose ps` con `backend` y `frontend` `healthy` al inicio y al final.
- [ ] Los cuatro roles iniciaron sesión con `Test1234!`.
- [ ] Todos los casos `CT-*` ejecutados por rol.
- [ ] Cada caso `FALLA` tiene defecto con severidad y evidencia.
- [ ] Cada `BLOQ.` tiene justificación (dato faltante o dependencia).
- [ ] Hallazgos conocidos confirmados o descartados explícitamente.
- [ ] Resumen de la sección 2 completo.
- [ ] Capturas archivadas en `docs/qa/evidencias/<rol>/`.
- [ ] Defectos S1/S2 reportados al equipo antes de cerrar la sesión.
