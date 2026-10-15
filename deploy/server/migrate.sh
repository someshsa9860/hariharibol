#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

# Apply pending Prisma migrations in a throwaway container, not inside the running api: the Prisma CLI
# starts its own Node process and query engine, and inside the api's memory limit it gets killed, which
# can pass without a word. Run before anything is stopped, and set -e aborts the deploy if it fails, so
# the old containers keep serving.
echo "==> Applying pending migrations using $BACKEND_IMAGE"
docker run --rm \
  --env-file "$ENV_FILE" \
  --memory="$MIGRATE_MEMORY" \
  "$BACKEND_IMAGE" npx prisma migrate deploy
echo "==> Migrations applied."
