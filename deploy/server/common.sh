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

# The CI workflows pass the registry they just pushed to. If .env names another
# one, the pull below would fetch the old image and the deploy would still look
# green, so stop instead.
if [[ -n "${EXPECT_ECR_REGISTRY:-}" && "$EXPECT_ECR_REGISTRY" != "$ECR_REGISTRY" ]]; then
  echo "CI pushed to $EXPECT_ECR_REGISTRY but $SCRIPT_DIR/.env deploys from $ECR_REGISTRY; set ECR_REGISTRY there." >&2
  exit 1
fi

login_ecr() {
  # .env also holds the app's own S3 keys, and the allexport above put them in
  # the environment, where they beat ~/.aws. The registry login must use the
  # server's own `aws configure` identity, so leave those keys out of this call.
  env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN \
    aws ecr get-login-password --region "$AWS_REGION" |
    docker login --username AWS --password-stdin "$ECR_REGISTRY"
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
