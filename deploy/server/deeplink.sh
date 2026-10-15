#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

stop_remove_container hariharibol-deeplink

docker run -d \
  --name hariharibol-deeplink \
  --network "$NETWORK" \
  -p 127.0.0.1:4002:4002 \
  --env-file "$ENV_FILE" \
  --memory="$DEEPLINK_MEMORY" \
  --memory-swap="$DEEPLINK_MEMORY" \
  --cpus="$DEEPLINK_CPU" \
  -e NODE_OPTIONS="--max-old-space-size=$DEEPLINK_HEAP_MB" \
  --restart unless-stopped \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -v "$SECRETS_DIR:/app/secrets:ro" \
  "$BACKEND_IMAGE" node deeplink/index.js
