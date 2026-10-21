#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

# ./pull.sh [backend|admin|website|all]
login_ecr
case "${1:-all}" in
  backend) docker pull "$BACKEND_IMAGE" ;;
  admin)   docker pull "$ADMIN_IMAGE" ;;
  website) docker pull "$WEBSITE_IMAGE" ;;
  *)       docker pull "$BACKEND_IMAGE"; docker pull "$ADMIN_IMAGE"; docker pull "$WEBSITE_IMAGE" ;;
esac
