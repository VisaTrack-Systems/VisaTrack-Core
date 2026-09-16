#!/bin/sh
# Container entrypoint for the API. Platforms such as Railway assign the
# listening port at runtime through PORT and abort a deployment when the
# health check cannot reach the process on that port.
set -eu

cd "$(dirname "$0")/.."

port="${PORT:-8000}"
forwarded_allow_ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}"

# Opt-in: the baseline revision creates tables unconditionally, so a database
# that already has the schema must be stamped before migrating on boot.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "startup: applying alembic migrations"
    alembic upgrade head
else
    echo "startup: skipping alembic migrations (RUN_MIGRATIONS=${RUN_MIGRATIONS:-false})"
fi

echo "startup: serving app.main:app on 0.0.0.0:${port}"
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${port}" \
    --proxy-headers \
    --forwarded-allow-ips "${forwarded_allow_ips}"
