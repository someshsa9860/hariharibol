#!/bin/bash
set -e
source "$(dirname "$0")/common.sh"

# The website is a Next.js server in its own image (hariharibol-website, built by deploy-website.yml);
# ./pull.sh website fetches it. The image holds no settings of its own: the sign-in values come from the same
# server/.env the backend reads, so changing one is an edit there and `./deploy.sh website` (a restart, no rebuild).
#
# Only the WEBSITE_* keys are handed over, never the whole file — it also holds the database URL, the JWT secret, the
# AWS and AI keys, and a web server has no use for them. The file is read line by line instead of sourced because its
# values contain & and ?; a value may be wrapped in one pair of quotes (docker's --env-file would keep them).
env_value () {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  if [[ "$line" =~ ^\"(.*)\"$ || "$line" =~ ^\'(.*)\'$ ]]; then line="${BASH_REMATCH[1]}"; fi
  printf '%s' "$line"
}

# API_BASE_URL is how this server reaches the API when it renders a page (the backend's own API_BASE_URL is another
# thing and is never passed on).
api_url="$(env_value WEBSITE_API_URL)"
env_args=(-e "API_BASE_URL=${api_url:-https://api.hariharibol.com}")
for key in WEBSITE_GOOGLE_CLIENT_ID WEBSITE_APPLE_CLIENT_ID WEBSITE_RECAPTCHA_SITE_KEY; do
  value="$(env_value "$key")"
  [ -z "$value" ] || env_args+=(-e "$key=$value")
done

# The Firebase web config is either the JSON itself (WEBSITE_FIREBASE_CONFIG) or, named the way the backend names its
# files, a file in the secrets folder (WEBSITE_FIREBASE_CONFIG_PATH=/app/secrets/firebase-web.json); the file wins. It is
# read here, on the host, so the website container never mounts the secrets folder (the service-account key is in it).
# A path that cannot be read stops the deploy before the running container is touched.
firebase_config="$(env_value WEBSITE_FIREBASE_CONFIG)"
firebase_path="$(env_value WEBSITE_FIREBASE_CONFIG_PATH)"
if [ -n "$firebase_path" ]; then
  case "$firebase_path" in
    /app/secrets/*..*|/app/secrets/) host_file="" ;;
    /app/secrets/*) host_file="$SECRETS_DIR/${firebase_path#/app/secrets/}" ;;
    *) host_file="" ;;
  esac
  if [ -z "$host_file" ] || [ ! -r "$host_file" ]; then
    echo "WEBSITE_FIREBASE_CONFIG_PATH is '$firebase_path': it must be /app/secrets/<file>, and <file> must be in $SECRETS_DIR" >&2
    exit 1
  fi
  firebase_config="$(cat "$host_file")"
fi
[ -z "$firebase_config" ] || env_args+=(-e "WEBSITE_FIREBASE_CONFIG=$firebase_config")

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
  "${env_args[@]}" \
  "$WEBSITE_IMAGE"
