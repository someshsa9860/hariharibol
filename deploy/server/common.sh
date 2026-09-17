#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Runtime secrets stay on the server. Exporting this file also supplies the
# Compose interpolation values used for ECR image names.
if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "Missing $SCRIPT_DIR/.env; copy .env.example and fill in server values." >&2
  exit 1
fi
set -o allexport
source "$SCRIPT_DIR/config.sh"
source "$ENV_FILE"
set +o allexport

: "${ECR_REGISTRY:?Set ECR_REGISTRY, for example 123456789012.dkr.ecr.ap-south-1.amazonaws.com}"

export ECR_REGISTRY

login_ecr() {
  if [[ -n "${ECR_PASSWORD:-}" ]]; then
    printf '%s' "$ECR_PASSWORD" |
      docker login --username AWS --password-stdin "$ECR_REGISTRY"
  else
    aws ecr get-login-password --region "$AWS_REGION" |
      docker login --username AWS --password-stdin "$ECR_REGISTRY"
  fi
}

update_service() {
  local service="$1"
  login_ecr
  "${COMPOSE[@]}" pull "$service"
  "${COMPOSE[@]}" up -d --no-deps "$service"
}

pull_service() {
  local service="$1"
  login_ecr
  "${COMPOSE[@]}" pull "$service"
}
