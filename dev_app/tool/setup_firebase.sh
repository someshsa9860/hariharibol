#!/usr/bin/env bash
# Registers the dev app with Firebase and writes the two config files the build reads.
#
#   firebase login            # as the account that owns the Firebase project
#   tool/setup_firebase.sh    # FIREBASE_PROJECT=<id> to use another project
#
# Safe to run again: an app that is already registered is reused, a SHA that is already there is skipped, and the
# config files are fetched afresh (run it again a few minutes after the first time if google-services.json comes
# back without a web client — Google creates the OAuth clients a little after the SHA is added).
#
# Writes (all gitignored except Info.plist):
#   android/app/google-services.json
#   ios/Runner/GoogleService-Info.plist
#   ios/Runner/Info.plist   — the Google sign-in URL scheme (REVERSED_CLIENT_ID), which is not a secret
#
# The default project is the one the production API sends push and checks App Check with, which is where this
# app has to be: the app talks to production by default.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PROJECT="${FIREBASE_PROJECT:-ramkrishnahari-e6e48}"
APP_ID="com.sss.hariharibol.dev"
DISPLAY_NAME="HariHariBol Dev"
DEBUG_KEYSTORE="${DEBUG_KEYSTORE:-$HOME/.android/debug.keystore}"

ANDROID_JSON="android/app/google-services.json"
IOS_PLIST="ios/Runner/GoogleService-Info.plist"
INFO_PLIST="ios/Runner/Info.plist"

fail() { echo "setup_firebase: $*" >&2; exit 1; }
say() { echo "• $*"; }

command -v firebase >/dev/null || fail "the firebase CLI is not installed (npm i -g firebase-tools)."
command -v python3 >/dev/null || fail "python3 is needed to read the CLI's JSON."

if ! firebase projects:list --json 2>/dev/null | python3 -c '
import json, sys
project = sys.argv[1]
ids = [p.get("projectId") for p in json.load(sys.stdin).get("result", [])]
sys.exit(0 if project in ids else 1)' "$PROJECT"; then
  echo "setup_firebase: the signed-in Firebase account cannot see project $PROJECT." >&2
  firebase login:list >&2 || true
  fail "run 'firebase login:add' (or 'firebase login --reauth') as the project's owner and try again."
fi
say "project $PROJECT"

# ── find or create an app, print its id ─────────────────────────────────────
app_id_of() { # platform → appId of the app registered for $APP_ID, or nothing
  firebase apps:list "$1" --project "$PROJECT" --json 2>/dev/null | python3 -c '
import json, sys
want = sys.argv[1]
for app in json.load(sys.stdin).get("result", []):
    if want in (app.get("packageName"), app.get("bundleId"), app.get("namespace")):
        print(app["appId"])
        break' "$APP_ID"
}

ensure_app() { # platform, flag → appId
  local platform="$1" flag="$2" id
  id="$(app_id_of "$platform")"
  if [[ -z "$id" ]]; then
    firebase apps:create "$platform" "$DISPLAY_NAME" "$flag" "$APP_ID" --project "$PROJECT" >&2
    id="$(app_id_of "$platform")"
    [[ -n "$id" ]] || fail "created the $platform app but cannot find it again."
    say "created the $platform app $id" >&2
  else
    say "$platform app already there: $id" >&2
  fi
  echo "$id"
}

ANDROID_APP="$(ensure_app ANDROID --package-name)"
IOS_APP="$(ensure_app IOS --bundle-id)"

# ── Android signing certificates ────────────────────────────────────────────
# Google sign-in fails with a bare DEVELOPER_ERROR unless the SHA of the key that signed the build is registered.
sha_of() { # keystore alias storepass → "SHA1 SHA256" without colons, lowercase
  keytool -list -v -keystore "$1" -alias "$2" -storepass "$3" 2>/dev/null |
    awk '/SHA1:/ {a=$2} /SHA256:/ {b=$2} END {print a, b}' | tr -d ':' | tr 'A-Z' 'a-z'
}

registered_shas() {
  firebase apps:android:sha:list "$ANDROID_APP" --project "$PROJECT" 2>/dev/null | tr -d ':' | tr 'A-Z' 'a-z'
}

add_shas() { # label, "sha1 sha256"
  local label="$1" sha existing
  existing="$(registered_shas)"
  for sha in $2; do
    [[ -n "$sha" ]] || continue
    if grep -q "$sha" <<<"$existing"; then
      say "$label SHA already registered (${sha:0:12}…)"
    else
      firebase apps:android:sha:create "$ANDROID_APP" "$sha" --project "$PROJECT" >/dev/null
      say "registered $label SHA (${sha:0:12}…)"
    fi
  done
}

if [[ -f "$DEBUG_KEYSTORE" ]]; then
  add_shas "debug" "$(sha_of "$DEBUG_KEYSTORE" androiddebugkey android)"
else
  say "no debug keystore at $DEBUG_KEYSTORE — skipped"
fi

if [[ -f android/key.properties ]]; then
  prop() { sed -n "s/^$1=//p" android/key.properties; }
  release_store="android/app/$(prop storeFile)"
  if [[ -f "$release_store" ]]; then
    add_shas "release" "$(sha_of "$release_store" "$(prop keyAlias)" "$(prop storePassword)")"
  fi
else
  say "no android/key.properties — release SHA not registered"
fi
# A build signed by Play App Signing has Google's key, not ours: add that SHA-1 from the Play Console
# (Setup → App signing) with: firebase apps:android:sha:create $ANDROID_APP <sha> --project $PROJECT

# ── config files ────────────────────────────────────────────────────────────
firebase apps:sdkconfig ANDROID "$ANDROID_APP" --project "$PROJECT" --out "$ANDROID_JSON" >/dev/null
say "wrote $ANDROID_JSON"
firebase apps:sdkconfig IOS "$IOS_APP" --project "$PROJECT" --out "$IOS_PLIST" >/dev/null
say "wrote $IOS_PLIST"

python3 - "$ANDROID_JSON" <<'PY'
import json, sys
config = json.load(open(sys.argv[1]))
clients = [c for c in config.get("client", []) if c["client_info"]["android_client_info"]["package_name"] == "com.sss.hariharibol.dev"]
oauth = clients[0].get("oauth_client", []) if clients else []
web = [o["client_id"] for o in oauth if o.get("client_type") == 3]
print("• Android web client id:", web[0] if web else "MISSING — run this script again in a few minutes")
PY

# ── iOS: the Google sign-in URL scheme ──────────────────────────────────────
plist_value() { /usr/libexec/PlistBuddy -c "Print :$1" "$IOS_PLIST" 2>/dev/null || true; }
reversed="$(plist_value REVERSED_CLIENT_ID)"
ios_client="$(plist_value CLIENT_ID)"

if [[ -z "$reversed" ]]; then
  say "GoogleService-Info.plist has no REVERSED_CLIENT_ID — the iOS Google client is not there yet."
  say "Run this script again in a few minutes, or create an iOS OAuth client for $APP_ID in Google Cloud and pass GOOGLE_IOS_CLIENT_ID."
elif /usr/libexec/PlistBuddy -c "Print :CFBundleURLTypes" "$INFO_PLIST" 2>/dev/null | grep -q "$reversed"; then
  say "Info.plist already has the URL scheme"
else
  buddy() { /usr/libexec/PlistBuddy -c "$1" "$INFO_PLIST"; }
  buddy "Add :CFBundleURLTypes array" 2>/dev/null || true
  buddy "Add :CFBundleURLTypes:0 dict"
  buddy "Add :CFBundleURLTypes:0:CFBundleTypeRole string Editor"
  buddy "Add :CFBundleURLTypes:0:CFBundleURLName string google-sign-in"
  buddy "Add :CFBundleURLTypes:0:CFBundleURLSchemes array"
  buddy "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $reversed"
  say "added the URL scheme to $INFO_PLIST"
fi

cat <<EOF

Done. Still to do by hand (Firebase / Google / Apple consoles — none of it has a CLI):
  1. App Check → Apps: register both apps ($ANDROID_APP, $IOS_APP) — Play Integrity for Android, App Attest for
     iOS — and, for debug builds, add the debug token the app prints (or the API refuses sign-in in production).
  2. Cloud Messaging → Apple app configuration: the APNs key is shared by every iOS app in the project; nothing
     to add if the reader app already has one.
  3. Apple Developer → Identifiers → $APP_ID: enable Push Notifications and App Attest.
  4. The API accepts a Google ID token only if its audience is in GOOGLE_CLIENT_IDS. Build with
     --dart-define=GOOGLE_SERVER_CLIENT_ID=<the web client id above> on both platforms and the token's audience is
     the web client, which production already lists; otherwise add the iOS CLIENT_ID (${ios_client:-none yet}) to the
     server's list. See "Setup the owner has to do" in CLAUDE.md.
EOF
