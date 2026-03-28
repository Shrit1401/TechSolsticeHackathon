#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
export COMPOSE_BAKE=false
export DOCKER_BUILDKIT=0
exec docker compose "$@"
