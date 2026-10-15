#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

stop_remove_container hariharibol-api

docker run -d \
  --name hariharibol-api \
  --network "$NETWORK" \
  -p 127.0.0.1:4000:4000 \
  --env-file "$ENV_FILE" \
  --memory="$API_MEMORY" \
  --memory-swap="$API_MEMORY" \
  --cpus="$API_CPU" \
  -e NODE_OPTIONS="--max-old-space-size=$API_HEAP_MB" \
  --restart unless-stopped \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -v "$SECRETS_DIR:/app/secrets:ro" \
  "$BACKEND_IMAGE" node server.js
