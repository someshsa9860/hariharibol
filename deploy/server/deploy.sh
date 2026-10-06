#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
source "$ENV_FILE"
export IMAGE_TAG="${IMAGE_TAG:-latest}"
if [[ -n "${2:-}" ]]; then export IMAGE_TAG="$2"; fi

case "${1:-all}" in
  admin) "$SCRIPT_DIR/admin.sh" ;;
  website) "$SCRIPT_DIR/website.sh" ;;
  backend)
    "$SCRIPT_DIR/api.sh"
    "$SCRIPT_DIR/worker.sh"
    "$SCRIPT_DIR/socket.sh"
    "$SCRIPT_DIR/deeplink.sh"
    ;;
  all)
    "$SCRIPT_DIR/api.sh"
    "$SCRIPT_DIR/worker.sh"
    "$SCRIPT_DIR/socket.sh"
    "$SCRIPT_DIR/deeplink.sh"
    "$SCRIPT_DIR/admin.sh"
    "$SCRIPT_DIR/website.sh"
    ;;
  *)
    echo "usage: $0 [admin|website|backend|all]" >&2
    exit 2
    ;;
esac
