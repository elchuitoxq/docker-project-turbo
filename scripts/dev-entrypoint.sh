#!/bin/sh
set -e

if [ -n "$WAIT_FOR_POSTGRES" ]; then
  echo "[entrypoint] Esperando a Postgres en ${DATABASE_HOST:-postgres}:5432..."
  ATTEMPTS=0
  MAX_ATTEMPTS=60
  until nc -z "${DATABASE_HOST:-postgres}" 5432 2>/dev/null; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
      echo "[entrypoint] Postgres no respondio despues de ${MAX_ATTEMPTS}s. Abortando."
      exit 1
    fi
    sleep 1
  done
  echo "[entrypoint] Postgres listo (esperado ${ATTEMPTS}s)"
fi

# El backend consume el paquete `database` compilado (dist). Sin este build el
# runtime fallaria al resolver `require('database')`.
if [ "$BUILD_DATABASE" = "true" ]; then
  echo "[entrypoint] Compilando paquete database..."
  pnpm --filter database build
fi

if [ "$RUN_DATABASE_SETUP" = "true" ]; then
  echo "[entrypoint] Aplicando migraciones de la base de desarrollo..."
  pnpm --filter database db:migrate
  echo "[entrypoint] Sembrando fixtures de desarrollo..."
  pnpm --filter database db:seed:dev
fi

if [ "$GENERATE_OPENAPI" = "true" ]; then
  echo "[entrypoint] Generando openapi.json..."
  pnpm openapi:export
  echo "[entrypoint] openapi.json generado"
fi

echo "[entrypoint] Ejecutando: $*"
exec "$@"
