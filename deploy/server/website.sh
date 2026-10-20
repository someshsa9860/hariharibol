#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

# The website is a Next.js server. CI uploads its standalone build (server.js, the few modules it needs, .next/static,
# public/) as website.tgz; it is unpacked here and a public Node image runs it, so no ECR login is needed and the site
# deploys even when the server has no AWS credentials. API_BASE_URL lets the server reach the API directly.
rm -rf "$WEBSITE_DIR/app.new"
mkdir -p "$WEBSITE_DIR/app.new"
tar xzf "$WEBSITE_DIR/website.tgz" -C "$WEBSITE_DIR/app.new"
rm -rf "$WEBSITE_DIR/app"
mv "$WEBSITE_DIR/app.new" "$WEBSITE_DIR/app"

stop_remove_container hariharibol-website

docker run -d \
  --name hariharibol-website \
  -p 127.0.0.1:8081:3000 \
  --memory="$WEBSITE_MEMORY" \
  --memory-swap="$WEBSITE_MEMORY" \
  --cpus="$WEBSITE_CPU" \
  --restart unless-stopped \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOSTNAME=0.0.0.0 \
  -e NEXT_TELEMETRY_DISABLED=1 \
  -e API_BASE_URL="${WEBSITE_API_URL:-https://api.hariharibol.com}" \
  -v "$WEBSITE_DIR/app:/app:ro" \
  -w /app \
  "$WEBSITE_IMAGE" node server.js
