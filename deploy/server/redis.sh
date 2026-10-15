#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

# Redis is started once and left alone by deploys, so a deploy never interrupts the job queue.
# To apply a changed limit: docker rm -f hariharibol-redis && ./redis.sh  (the data volume stays)
if [ "$(docker inspect -f '{{.State.Running}}' hariharibol-redis 2>/dev/null)" = "true" ]; then
  echo "hariharibol-redis is already running"
  exit 0
fi

stop_remove_container hariharibol-redis

docker run -d \
  --name hariharibol-redis \
  --network "$NETWORK" \
  --network-alias redis \
  --env-file "$ENV_FILE" \
  --memory="$REDIS_MEMORY" \
  --memory-swap="$REDIS_MEMORY" \
  --cpus="$REDIS_CPU" \
  --restart unless-stopped \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -v hariharibol_redis:/data \
  "$REDIS_IMAGE" \
  sh -c "exec redis-server --appendonly yes --requirepass \"\$REDIS_PASSWORD\" --maxmemory $REDIS_MAXMEMORY --maxmemory-policy noeviction"

# The api and worker connect as soon as they start, so wait until redis answers.
for i in $(seq 1 20); do
  if docker exec hariharibol-redis sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" ping' 2>/dev/null | grep -q PONG; then
    exit 0
  fi
  sleep 1
done
echo "hariharibol-redis did not answer within 20 seconds" >&2
exit 1
