#!/bin/bash
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null

# stop_remove_container <name> [seconds to wait before killing, default 10]
stop_remove_container () {
  docker stop -t "${2:-10}" "$1" 2>/dev/null || true
  docker rm "$1" 2>/dev/null || true
}

login_ecr () {
  # The workflows say which registry they just pushed to. If this server is set up for another one,
  # the pull below would fetch the old image and the deploy would still look green, so stop.
  if [ -n "${EXPECT_ECR_REGISTRY:-}" ] && [ "$EXPECT_ECR_REGISTRY" != "$ECR_REGISTRY" ]; then
    echo "CI pushed to $EXPECT_ECR_REGISTRY but config.sh deploys from $ECR_REGISTRY" >&2
    exit 1
  fi
  aws ecr get-login-password --region "$AWS_REGION" |
    docker login --username AWS --password-stdin "$ECR_REGISTRY"
}
