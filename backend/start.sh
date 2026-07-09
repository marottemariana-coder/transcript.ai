#!/bin/sh
# Roda a API e o worker no mesmo container/disco (uso em producao single-tenant,
# ex: Railway, onde volumes nao sao compartilhados entre servicos separados).
# "wait -n" e bashismo e nao existe no dash/sh deste container, entao usamos um
# loop de checagem: se um dos dois processos cair, mata o outro e sai (o Railway
# reinicia o container).
set -e

celery -A app.workers.celery_app worker --loglevel=info &
CELERY_PID=$!

uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" &
UVICORN_PID=$!

while kill -0 "$CELERY_PID" 2>/dev/null && kill -0 "$UVICORN_PID" 2>/dev/null; do
  sleep 2
done

kill "$CELERY_PID" "$UVICORN_PID" 2>/dev/null || true
exit 1
