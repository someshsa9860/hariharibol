#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Deploy the BACKEND — pull latest API image from ECR, ensure postgres + redis
# are up, run DB migrations, then (re)start the API container.
# Run from /var/www/server/backend/  →  ./config.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../config.sh"

cd "${SCRIPT_DIR}"

if [ ! -f .env ]; then
  echo "❌ Missing .env in ${SCRIPT_DIR}"
  echo "   Copy .env.example → .env and fill in the values first."
  exit 1
fi

section "Deploying Backend API"

ecr_login

echo "📥 Pulling latest image: ${BACKEND_IMAGE}"
docker pull "${BACKEND_IMAGE}"

echo "🐘 Starting datastores (postgres, redis)..."
BACKEND_IMAGE="${BACKEND_IMAGE}" docker compose up -d postgres redis

echo "⏳ Waiting for postgres to be healthy..."
until docker compose ps --status running | grep -q hariharibol-postgres \
  && docker inspect --format '{{.State.Health.Status}}' hariharibol-postgres 2>/dev/null | grep -q healthy; do
  sleep 2
  echo "   ...still waiting for postgres"
done

echo "🗃️  Running Prisma migrations..."
BACKEND_IMAGE="${BACKEND_IMAGE}" docker compose run --rm api npx prisma migrate deploy || {
  echo "⚠️  Migration step failed or no migrations to apply — continuing."
}

echo "🚀 Starting API container..."
BACKEND_IMAGE="${BACKEND_IMAGE}" docker compose up -d --remove-orphans

echo "⏳ Waiting for API health check..."
sleep 10

section "Status"
docker compose ps

echo ""
if docker compose ps --status running | grep -q hariharibol-api; then
  echo "✅ Backend API is running on port 3001"
else
  echo "⚠️  API not healthy yet — check logs:"
  echo "    docker compose logs -f api"
fi
