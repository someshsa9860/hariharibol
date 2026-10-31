#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

# Raise the build number (the +N in pubspec.yaml) by one before every IPA, so
# App Store Connect never gets a number it has already seen. The version name
# (the part before +) is left as it is.
PUBSPEC="$APP_DIR/pubspec.yaml"
current="$(sed -n 's/^version: *//p' "$PUBSPEC")"
name="${current%+*}"
build="${current##*+}"
if [[ "$current" != *+* || ! "$build" =~ ^[0-9]+$ ]]; then
  echo "build_ipa.sh: pubspec.yaml version must end in +<build number>, found: $current" >&2
  exit 1
fi
next=$((10#$build + 1))
sed -i '' "s/^version: .*/version: ${name}+${next}/" "$PUBSPEC"
echo "build_ipa.sh: build number $build -> $next (version $name unchanged)" >&2

FLUTTER_BIN="${FLUTTER_BIN:-$APP_DIR/tool/flutter.sh}"
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

exec "$FLUTTER_BIN" build ipa "${defines[@]}" "$@"
