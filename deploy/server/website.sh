#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

# A public nginx image serving the built files, so no ECR login: the landing page must deploy even
# when the server has no AWS credentials. The files are replaced in place, not by restarting this.
stop_remove_container hariharibol-website

docker run -d \
  --name hariharibol-website \
  -p 127.0.0.1:8081:80 \
  --memory="$WEBSITE_MEMORY" \
  --memory-swap="$WEBSITE_MEMORY" \
  --cpus="$WEBSITE_CPU" \
  --restart unless-stopped \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -v "$WEBSITE_DIR:/usr/share/nginx/html:ro" \
  "$WEBSITE_IMAGE"
