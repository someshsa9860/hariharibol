#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

stop_remove_container hariharibol-socket

docker run -d \
  --name hariharibol-socket \
  --network "$NETWORK" \
  -p 127.0.0.1:4001:4001 \
  --env-file "$ENV_FILE" \
  --memory="$SOCKET_MEMORY" \
  --memory-swap="$SOCKET_MEMORY" \
  --cpus="$SOCKET_CPU" \
  --ulimit nofile=65535:65535 \
  -e NODE_OPTIONS="--max-old-space-size=$SOCKET_HEAP_MB" \
  --restart unless-stopped \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -v "$SECRETS_DIR:/app/secrets:ro" \
  "$BACKEND_IMAGE" node websocket/index.js
