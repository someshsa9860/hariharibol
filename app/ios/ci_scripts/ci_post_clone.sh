#!/bin/sh
# Xcode Cloud post-clone step for the iOS app.
#
# Xcode Cloud clones the repo and archives app/ios/Runner.xcworkspace with plain
# xcodebuild — it never runs `flutter build`. This script prepares everything
# that archive needs: the pinned Flutter SDK, the gitignored Firebase config,
# the Flutter-generated xcconfig (version, build number, dart-defines) and the
# CocoaPods install. Setup of the workflow itself: "Releasing the iOS app" in
# app/CLAUDE.md.
#
# Workflow environment variables (Xcode Cloud workflow → Environment; tick
# "Secret" on each):
#   GOOGLE_SERVICE_INFO_PLIST  required  base64 of ios/Runner/GoogleService-Info.plist
#                                        (`base64 -i ios/Runner/GoogleService-Info.plist | pbcopy`)
#   API_BASE_URL               optional  https:// only; unset → the app's own default (production)
#   GOOGLE_SERVER_CLIENT_ID    optional  the web client id; unset → not defined
#   GOOGLE_IOS_CLIENT_ID       optional  normally read from the plist; unset → not defined
#   FLUTTER_VERSION            optional  overrides app/.flutter-version
#
# The build number comes from Xcode Cloud ($CI_BUILD_NUMBER), not pubspec —
# Xcode Cloud stamps its own number on every build it distributes. Set "Next
# Build Number" in App Store Connect → Xcode Cloud → Settings so it continues
# above pubspec's (and above the last upload). The marketing version still
# comes from pubspec's `version:`.

set -e

APP_DIR="$CI_PRIMARY_REPOSITORY_PATH/app"
cd "$APP_DIR"

# One pin for the whole project: tool/flutter.sh reads the same file.
FLUTTER_VERSION="${FLUTTER_VERSION:-$(tr -d '[:space:]' < .flutter-version)}"

echo "Installing Flutter $FLUTTER_VERSION"
git clone https://github.com/flutter/flutter.git --depth 1 -b "$FLUTTER_VERSION" "$HOME/flutter"
export PATH="$HOME/flutter/bin:$PATH"
flutter --version

# Flutter's Swift Package Manager support decides per-plugin, from cached
# state, whether a plugin's iOS deps come from CocoaPods or a remote SPM
# package. From a clean clone it picks SPM for some plugins, adding a package
# Xcode Cloud has never seen. Xcode Cloud disables automatic package resolution
# and requires a committed Package.resolved for any such package, so the build
# fails with "a resolved file is required". The Podfile installs every plugin
# via CocoaPods, so keep Flutter off SPM and avoid that resolution entirely.
# (This also strips the FlutterGeneratedPluginSwiftPackage a laptop's Flutter
# wrote into the Xcode project — in this CI checkout only.)
flutter config --no-enable-swift-package-manager
flutter precache --ios

echo "Restoring gitignored config files"
if [ -z "$GOOGLE_SERVICE_INFO_PLIST" ]; then
  echo "error: GOOGLE_SERVICE_INFO_PLIST is not set — add the base64 of ios/Runner/GoogleService-Info.plist as a secret workflow environment variable." >&2
  exit 1
fi
printf '%s' "$GOOGLE_SERVICE_INFO_PLIST" | base64 --decode > ios/Runner/GoogleService-Info.plist
plutil -lint ios/Runner/GoogleService-Info.plist
# `Firebase.initializeApp()` reads this file natively on iOS, so the Dart-side
# firebase_options.dart (also gitignored) is not needed to build or run.

# The build-time defines, kept outside the checkout. Only what is set is
# written; everything else falls back to the app's own defaults
# (core/constants/app_config.dart), the same as `./build_ipa.sh`.
DEFINES_FILE="$HOME/hariharibol-dart-defines.json"
if [ -n "$API_BASE_URL" ]; then
  case "$API_BASE_URL" in
    https://*) ;;
    *)
      echo "error: API_BASE_URL must start with https:// for a build Xcode Cloud distributes." >&2
      exit 1
      ;;
  esac
fi
{
  printf '{'
  separator=''
  for name in API_BASE_URL GOOGLE_SERVER_CLIENT_ID GOOGLE_IOS_CLIENT_ID; do
    eval "value=\${$name}"
    if [ -n "$value" ]; then
      printf '%s"%s": "%s"' "$separator" "$name" "$value"
      separator=', '
    fi
  done
  printf '}\n'
} > "$DEFINES_FILE"
# `plutil -lint` rejects JSON; `-p` parses it, so a malformed value stops here
# and not inside the archive.
plutil -p "$DEFINES_FILE" > /dev/null

if ! command -v pod > /dev/null; then
  echo "Installing CocoaPods"
  HOMEBREW_NO_AUTO_UPDATE=1 brew install cocoapods
fi

# --config-only runs pub get, writes ios/Flutter/Generated.xcconfig (build
# name/number, dart-defines) and installs pods, without compiling — the
# archive step that follows does the build.
echo "Generating Flutter iOS config (build $CI_BUILD_NUMBER)"
flutter build ios --release --config-only \
  --build-number="$CI_BUILD_NUMBER" \
  --dart-define-from-file="$DEFINES_FILE"

echo "ci_post_clone.sh completed"
