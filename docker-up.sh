#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
export COMPOSE_BAKE=false
exec docker compose "$@"
