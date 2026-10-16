#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Shared deployment config — sourced by website/ and backend/ scripts.
# Lives at /var/www/server/config.sh on the live server.
# ──────────────────────────────────────────────────────────────────────────────

# ── AWS / ECR ─────────────────────────────────────────────────────────────────
export AWS_ACCOUNT_ID="572638914162"
export AWS_REGION="ap-south-1"
export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# ── Image repositories (must match GitHub Actions workflows) ───────────────────
export WEBSITE_IMAGE="${ECR_REGISTRY}/hariharibol-website:latest"
export BACKEND_IMAGE="${ECR_REGISTRY}/hariharibol-api:latest"

# ── Server paths ──────────────────────────────────────────────────────────────
export SERVER_ROOT="/var/www/server"
export WEBSITE_DIR="${SERVER_ROOT}/website"
export BACKEND_DIR="${SERVER_ROOT}/backend"

# ── Helpers ───────────────────────────────────────────────────────────────────

# Log in to ECR so `docker pull` works. Requires AWS CLI + credentials configured
# (run `aws configure` once on the server, or attach an IAM instance role).
ecr_login() {
  echo "🔐 Logging in to ECR (${ECR_REGISTRY})..."
  aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login --username AWS --password-stdin "${ECR_REGISTRY}"
}

# Pretty section header.
section() {
  echo ""
  echo "────────────────────────────────────────────────────────────"
  echo "  $1"
  echo "────────────────────────────────────────────────────────────"
}
