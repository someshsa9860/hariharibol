#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

FLUTTER_BIN="${FLUTTER_BIN:-$APP_DIR/tool/flutter.sh}"
API_BASE_URL="${API_BASE_URL:-https://api.hariharibol.com}"
EXTRA_DART_DEFINES=()
if [[ -f "$APP_DIR/config.sh" ]]; then
  source "$APP_DIR/config.sh"
fi

# A store bundle always talks to production. config.sh is for running on a
# laptop and usually points at localhost, which must never be baked into a
# release; RELEASE_API_BASE_URL is the one way to build against something else
# (a staging server), and it has to be https.
API_BASE_URL="${RELEASE_API_BASE_URL:-https://api.hariharibol.com}"
if [[ "$API_BASE_URL" != https://* ]]; then
  echo "build_bundle.sh: refusing to build a release against $API_BASE_URL (not https)." >&2
  exit 1
fi
echo "build_bundle.sh: API_BASE_URL=$API_BASE_URL" >&2

defines=(--dart-define="API_BASE_URL=$API_BASE_URL")
[[ -n "${GOOGLE_SERVER_CLIENT_ID:-}" ]] && defines+=(--dart-define="GOOGLE_SERVER_CLIENT_ID=$GOOGLE_SERVER_CLIENT_ID")
[[ -n "${GOOGLE_IOS_CLIENT_ID:-}" ]] && defines+=(--dart-define="GOOGLE_IOS_CLIENT_ID=$GOOGLE_IOS_CLIENT_ID")
if ((${#EXTRA_DART_DEFINES[@]})); then
  defines+=("${EXTRA_DART_DEFINES[@]}")
fi

exec "$FLUTTER_BIN" build appbundle "${defines[@]}" "$@"
