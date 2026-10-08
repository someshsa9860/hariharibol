#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"

# A public nginx image, so no ECR login: the landing page must deploy even
# when the server has no AWS credentials.
"${COMPOSE[@]}" pull website
"${COMPOSE[@]}" up -d --no-deps website
