#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

# The website is a Next.js server in its own image (hariharibol-website, built by deploy-website.yml);
# ./pull.sh website fetches it. NEXT_PUBLIC_* values are already inside the image. API_BASE_URL is only how this
# server reaches the API when it renders a page.
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
  -e NODE_OPTIONS="--max-old-space-size=$WEBSITE_HEAP_MB" \
  -e API_BASE_URL="${WEBSITE_API_URL:-https://api.hariharibol.com}" \
  "$WEBSITE_IMAGE"
