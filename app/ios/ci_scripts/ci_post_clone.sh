#!/bin/sh
# Xcode Cloud post-clone step for the iOS app.
#
# Xcode Cloud clones the repo and archives ios/Runner.xcworkspace with plain
# xcodebuild — it never runs `flutter build`. This script prepares everything
# that archive needs: the pinned Flutter SDK, the gitignored config files, the
# Flutter-generated xcconfig, and the CocoaPods install.
#
# Workflow environment variables (Xcode Cloud workflow → Environment; tick
# "Secret" on each):
#   GOOGLE_SERVICE_INFO_PLIST  required  base64 of ios/Runner/GoogleService-Info.plist
#                                        (`base64 -i ios/Runner/GoogleService-Info.plist | pbcopy`)
#   MAPS_API_KEY               optional  native Maps key; unset → AppDelegate's fallback
#   PLACES_API_KEY             optional  Dart Places key; unset → ApiKeys default
#   FLUTTER_VERSION            optional  overrides the SDK pinned below
#
# The build number comes from Xcode Cloud ($CI_BUILD_NUMBER), not pubspec —
# Xcode Cloud stamps its own number on every build it distributes. Set "Next
# Build Number" in App Store Connect → Xcode Cloud → Settings → Build Number so
# it continues pubspec's numbering. The marketing version still comes from
# pubspec's `version:`.

set -e

FLUTTER_VERSION="${FLUTTER_VERSION:-3.47.3}"

cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "Installing Flutter $FLUTTER_VERSION"
git clone https://github.com/flutter/flutter.git --depth 1 -b "$FLUTTER_VERSION" "$HOME/flutter"
export PATH="$HOME/flutter/bin:$PATH"
flutter --version

# Flutter's Swift Package Manager support decides per-plugin, from cached
# state, whether a plugin's iOS deps come from CocoaPods or a remote SPM
# package. From this repo's clean clone it picks SPM for some plugins (e.g.
# google_sign_in_ios -> GoogleSignIn-iOS), adding a package Xcode Cloud has
# never seen. Xcode Cloud disables automatic package resolution and requires
# a committed Package.resolved for any such package, so the build fails with
# "a resolved file is required". The Podfile already installs every plugin
# via CocoaPods, so keep Flutter off SPM and avoid that resolution entirely.
flutter config --no-enable-swift-package-manager
flutter precache --ios

echo "Restoring gitignored config files"
if [ -z "$GOOGLE_SERVICE_INFO_PLIST" ]; then
  echo "error: GOOGLE_SERVICE_INFO_PLIST is not set — add the base64 of ios/Runner/GoogleService-Info.plist as a secret workflow environment variable." >&2
  exit 1
fi
printf '%s' "$GOOGLE_SERVICE_INFO_PLIST" | base64 --decode > ios/Runner/GoogleService-Info.plist
plutil -lint ios/Runner/GoogleService-Info.plist

if [ -n "$MAPS_API_KEY" ]; then
  printf 'MAPS_API_KEY=%s\n' "$MAPS_API_KEY" > ios/Flutter/Secrets.xcconfig
fi

# Same shape as env.example.json. An empty value falls back to the key
# compiled into ApiKeys, so both entries are always written.
cat > env.json <<EOF
{
  "MAPS_API_KEY": "$MAPS_API_KEY",
  "PLACES_API_KEY": "$PLACES_API_KEY"
}
EOF

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
  --dart-define-from-file=env.json

echo "ci_post_clone.sh completed"
