#!/usr/bin/env bash
# psql inside the dev db container (no local psql needed). Usage: bash scripts/psql.sh -c 'select 1'
cd "$(dirname "$0")/.." && exec docker compose -f docker-compose.dev.yml exec -T db psql -U postgres -d savel "$@"
