#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"

pull_service api
"${COMPOSE[@]}" run --rm --no-deps api npx prisma migrate deploy
"${COMPOSE[@]}" up -d --no-deps api
