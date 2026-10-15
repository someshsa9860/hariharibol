#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

# A translation run in progress hands itself back to the queue on SIGTERM (worker/index.js); wait up to
# 40 seconds for it to finish the call and the save it is in, instead of docker's default 10.
stop_remove_container hariharibol-worker 40

docker run -d \
  --name hariharibol-worker \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  --memory="$WORKER_MEMORY" \
  --memory-swap="$WORKER_MEMORY" \
  --cpus="$WORKER_CPU" \
  -e NODE_OPTIONS="--max-old-space-size=$WORKER_HEAP_MB" \
  --restart unless-stopped \
  --stop-timeout 40 \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -v "$SECRETS_DIR:/app/secrets:ro" \
  "$BACKEND_IMAGE" node worker/index.js
