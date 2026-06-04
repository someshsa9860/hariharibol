#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Reclaim disk space — removes dangling images, stopped containers, build cache.
# Safe: never touches running containers or named volumes (postgres/redis data).
# Run periodically or after a few deploys to clear old ECR image layers.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

section "Disk usage BEFORE prune"
df -h / | awk 'NR==1 || /\/$/'
docker system df

section "Removing stopped containers"
docker container prune -f

section "Removing dangling images (untagged old ECR layers)"
docker image prune -f

section "Removing unused build cache"
docker builder prune -f

# Networks not attached to any container.
section "Removing unused networks"
docker network prune -f

# NOTE: we intentionally do NOT run `docker volume prune` or `system prune
# --volumes` — that would wipe the postgres/redis data volumes.

section "Disk usage AFTER prune"
df -h / | awk 'NR==1 || /\/$/'
docker system df

echo ""
echo "✅ Prune complete. Named volumes (db/redis data) were preserved."
