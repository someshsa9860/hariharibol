#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# ONE-TIME server bootstrap. Run once on a fresh EC2 instance as the ubuntu user.
# Installs Docker + AWS CLI, creates /var/www/server, and copies this folder in.
#
# Usage (from the directory containing this script):
#   sudo bash bootstrap.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TARGET="/var/www/server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "════════════════════════════════════════════════════════════"
echo "  HariHariBol server bootstrap"
echo "════════════════════════════════════════════════════════════"

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "🐳 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker ubuntu || true
else
  echo "✓ Docker already installed"
fi

# ── Docker Compose plugin ─────────────────────────────────────────────────────
if ! docker compose version >/dev/null 2>&1; then
  echo "🧩 Installing docker compose plugin..."
  apt-get update -y && apt-get install -y docker-compose-plugin
else
  echo "✓ docker compose available"
fi

# ── AWS CLI v2 ────────────────────────────────────────────────────────────────
if ! command -v aws >/dev/null 2>&1; then
  echo "☁️  Installing AWS CLI v2..."
  apt-get update -y && apt-get install -y unzip curl
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install --update
  rm -rf /tmp/aws /tmp/awscliv2.zip
else
  echo "✓ AWS CLI already installed"
fi

# ── Directory structure ───────────────────────────────────────────────────────
echo "📁 Creating ${TARGET} ..."
mkdir -p "${TARGET}/website/security" "${TARGET}/backend/security"

echo "📋 Copying deployment files..."
cp -n "${SCRIPT_DIR}/config.sh" "${TARGET}/config.sh"
cp -n "${SCRIPT_DIR}/prune.sh" "${TARGET}/prune.sh"

cp -n "${SCRIPT_DIR}/website/config.sh"          "${TARGET}/website/config.sh"
cp -n "${SCRIPT_DIR}/website/prune.sh"           "${TARGET}/website/prune.sh"
cp -n "${SCRIPT_DIR}/website/docker-compose.yml" "${TARGET}/website/docker-compose.yml"
cp -n "${SCRIPT_DIR}/website/.env.example"       "${TARGET}/website/.env.example"

cp -n "${SCRIPT_DIR}/backend/config.sh"          "${TARGET}/backend/config.sh"
cp -n "${SCRIPT_DIR}/backend/prune.sh"           "${TARGET}/backend/prune.sh"
cp -n "${SCRIPT_DIR}/backend/docker-compose.yml" "${TARGET}/backend/docker-compose.yml"
cp -n "${SCRIPT_DIR}/backend/.env.example"       "${TARGET}/backend/.env.example"

# ── Permissions ───────────────────────────────────────────────────────────────
chown -R ubuntu:ubuntu "${TARGET}"
chmod +x "${TARGET}"/*.sh "${TARGET}"/*/*.sh
chmod 700 "${TARGET}/website/security" "${TARGET}/backend/security"

echo ""
echo "✅ Bootstrap complete. Next steps:"
echo "   1. cd ${TARGET}/website  && cp .env.example .env  && nano .env"
echo "   2. cd ${TARGET}/backend  && cp .env.example .env  && nano .env"
echo "   3. Upload secret files into backend/security/ (firebase json, .p8 keys)"
echo "   4. Run 'aws configure' (or attach an IAM role) so ECR pull works"
echo "   5. ./website/config.sh   and   ./backend/config.sh"
echo ""
echo "   ⚠️  Log out and back in once so the 'docker' group applies to ubuntu."
