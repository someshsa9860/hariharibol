#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#  deploy.sh — Pull the latest website image from ECR and restart the container
#              with memory / CPU limits.
#
#  Usage:
#    bash deploy.sh              # use IMAGE_TAG from .env (default: latest)
#    bash deploy.sh <git-sha>    # pin to a specific image tag
#
#  Run from: /var/www/server/website/
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# ── Load .env ─────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill in values."
  exit 1
fi
set -o allexport && source .env && set +o allexport

# Allow overriding IMAGE_TAG from CLI arg
if [ -n "${1:-}" ]; then
  export IMAGE_TAG="$1"
fi
echo "==> Deploying tag: ${IMAGE_TAG:-latest}"

# ── Config (from .env, with sensible defaults) ────────────────────────────────
AWS_REGION="${AWS_REGION:-ap-south-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-669054244226}"
REGISTRY="${REGISTRY:-${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com}"
WEBSITE_IMAGE="${REGISTRY}/hariharibol-website:${IMAGE_TAG:-latest}"

CONTAINER_NAME="hariharibol-web"
HOST_PORT="${HOST_PORT:-3000}"

# Resource limits — protect the t3.micro (908MB RAM) from OOM.
MEM_LIMIT="${WEB_MEM_LIMIT:-450m}"
MEM_RESERVATION="${WEB_MEM_RESERVATION:-200m}"
CPU_LIMIT="${WEB_CPU_LIMIT:-0.75}"

# ── 1. ECR login ──────────────────────────────────────────────────────────────
echo ""
echo "── Step 1/5 — ECR login ─────────────────────────────────"
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin "${REGISTRY}"

# ── 2. Pull image ─────────────────────────────────────────────────────────────
echo ""
echo "── Step 2/5 — Pulling image ─────────────────────────────"
echo "    ${WEBSITE_IMAGE}"
docker pull "${WEBSITE_IMAGE}"

# ── 3. Stop & remove old container ────────────────────────────────────────────
echo ""
echo "── Step 3/5 — Replacing container ───────────────────────"
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm   "${CONTAINER_NAME}" 2>/dev/null || true

# ── 4. Run new container with limits ──────────────────────────────────────────
echo ""
echo "── Step 4/5 — Starting container ────────────────────────"
echo "    mem=${MEM_LIMIT} (reserve ${MEM_RESERVATION})  cpus=${CPU_LIMIT}  port=${HOST_PORT}"
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart always \
  --memory "${MEM_LIMIT}" \
  --memory-reservation "${MEM_RESERVATION}" \
  --cpus "${CPU_LIMIT}" \
  -p "${HOST_PORT}:3000" \
  --env-file .env \
  --health-cmd "wget -qO- http://localhost:3000/ || exit 1" \
  --health-interval 30s \
  --health-timeout 10s \
  --health-retries 3 \
  --health-start-period 20s \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  "${WEBSITE_IMAGE}"

# ── 5. Prune old images ───────────────────────────────────────────────────────
echo ""
echo "── Step 5/5 — Pruning dangling images ───────────────────"
docker image prune -f

# ── Status ────────────────────────────────────────────────────────────────────
echo ""
echo "── Container status ─────────────────────────────────────"
sleep 6
docker ps --filter "name=${CONTAINER_NAME}" \
  --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "==> Deploy complete"
echo "    Website: https://hariharibol.com"
