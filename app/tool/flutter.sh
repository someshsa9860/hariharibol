#!/usr/bin/env bash
# Runs the Flutter SDK this app is pinned to (.flutter-version), whatever `flutter`
# happens to be first on PATH:   tool/flutter.sh test
# run.sh, build_bundle.sh and build_ipa.sh go through it.
#
# It also removes what a different SDK left in .dart_tool, because an SDK cannot
# reuse that and fails with "Invalid kernel binary format version":
#   - native-asset hooks (.dart_tool/hooks_runner/*/*/hook.dill). The cache is not
#     keyed by SDK, so a build with another SDK leaves dills this one cannot load.
#   - package_config.json pointing at another SDK's framework, which an IDE's Dart
#     daemon will do on its own. Fixed with a `pub get`.
#
# The SDK is the first `flutter` on PATH whose version matches .flutter-version.
# Set FLUTTER_SDK=/path/to/sdk (in config.sh, say) when it is not on PATH.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

want="$(tr -d '[:space:]' < .flutter-version)"

sdk_version() {
  sed -n 's/.*"frameworkVersion": *"\([^"]*\)".*/\1/p' "$1/bin/cache/flutter.version.json" 2>/dev/null || true
}

sdk=""
if [[ -n "${FLUTTER_SDK:-}" ]]; then
  sdk="$FLUTTER_SDK"
else
  while IFS= read -r candidate; do
    root="$(cd -P "$(dirname "$candidate")/.." && pwd)"
    if [[ "$(sdk_version "$root")" == "$want" ]]; then
      sdk="$root"
      break
    fi
  done < <(type -ap flutter)
fi

if [[ -z "$sdk" || ! -x "$sdk/bin/flutter" ]]; then
  echo "tool/flutter.sh: Flutter $want not found on PATH (see .flutter-version)." >&2
  echo "  Add its bin/ to PATH, or set FLUTTER_SDK=/path/to/flutter_$want in config.sh." >&2
  exit 1
fi
export PATH="$sdk/bin:$PATH"

# Kernel format version, as the big-endian u32 after the 4-byte magic number.
kernel_version() {
  od -An -tx1 -j4 -N4 "$1" 2>/dev/null | tr -d ' \n' || true
}

sdk_kernel="$(kernel_version "$sdk/bin/cache/dart-sdk/lib/_internal/vm_platform_strong.dill")"
if [[ -n "$sdk_kernel" ]]; then
  for dill in .dart_tool/hooks_runner/*/*/hook.dill; do
    [[ -f "$dill" ]] || continue
    if [[ "$(kernel_version "$dill")" != "$sdk_kernel" ]]; then
      echo "tool/flutter.sh: removing $(dirname "$dill") (built by another Flutter SDK)" >&2
      rm -rf "$(dirname "$dill")"
    fi
  done
fi

if [[ -f .dart_tool/package_config.json ]] && ! grep -qF "$sdk/packages/flutter\"" .dart_tool/package_config.json; then
  echo "tool/flutter.sh: .dart_tool was resolved by another Flutter SDK; running pub get with $want" >&2
  "$sdk/bin/flutter" pub get >&2
fi

exec "$sdk/bin/flutter" "$@"
