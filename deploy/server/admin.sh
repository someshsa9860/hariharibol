#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

stop_remove_container hariharibol-admin

docker run -d \
  --name hariharibol-admin \
  -p 127.0.0.1:8080:80 \
  --memory="$ADMIN_MEMORY" \
  --memory-swap="$ADMIN_MEMORY" \
  --cpus="$ADMIN_CPU" \
  --restart unless-stopped \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  "$ADMIN_IMAGE"
