#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

FLUTTER_BIN="${FLUTTER_BIN:-flutter}"
API_BASE_URL="${API_BASE_URL:-https://api.hariharibol.com}"
EXTRA_DART_DEFINES=()
if [[ -f "$APP_DIR/config.sh" ]]; then
  source "$APP_DIR/config.sh"
fi

defines=(--dart-define="API_BASE_URL=$API_BASE_URL")
[[ -n "${GOOGLE_SERVER_CLIENT_ID:-}" ]] && defines+=(--dart-define="GOOGLE_SERVER_CLIENT_ID=$GOOGLE_SERVER_CLIENT_ID")
[[ -n "${GOOGLE_IOS_CLIENT_ID:-}" ]] && defines+=(--dart-define="GOOGLE_IOS_CLIENT_ID=$GOOGLE_IOS_CLIENT_ID")
if ((${#EXTRA_DART_DEFINES[@]})); then
  defines+=("${EXTRA_DART_DEFINES[@]}")
fi

exec "$FLUTTER_BIN" build appbundle "${defines[@]}" "$@"
