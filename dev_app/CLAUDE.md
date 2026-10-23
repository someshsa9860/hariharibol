# Dev app — HariHariBol Dev

The owner's companion: a live feed of server alerts, error spikes, sign-ups, tickets and feedback, and chat with
readers. Flutter (Android + iOS), **built like `app/`** — same folders (`core/`, `models/`, `providers/`,
`services/`, `views/`, `widgets/`), Riverpod, go_router, Dio, ARB localisation, the same `ApiClient` shape (silent
token refresh), and the same rules: nothing hardcoded, every word through `lib/l10n/app_en.arb`, no
`Color(0xFF…)` outside `core/theme/`. It has **English only** (it is not for readers); add a language the way
`app/` does if that ever changes. The backend half is "Developer companion" in [../backend/CLAUDE.md](../backend/CLAUDE.md).

Toolchain: Flutter **3.44.2** (`.flutter-version`), same as `app/`. `flutter pub get && flutter gen-l10n`
(commit `lib/l10n/generated/`), `flutter analyze`, `flutter test`.

## How it fits together

- **Sign-in**: Google only, through `/api/app/auth/social` (App Check attested, like the reader app), then
  `/api/admin/me`. An account without `dev.access` is signed out again with a plain message
  (`ApiFailure.notAllowed`); the backend refuses it on every route anyway.
- **Live**: `services/socket_service.dart` keeps `/ws?token=…&app=dev` open while signed in, reconnects with a
  growing pause and jitter, and sends `{type:'ping', foreground}` every 30 s (and at once when the app is
  backgrounded or resumed). **That heartbeat is what keeps the server from pushing while the app is on screen.**
  Providers (`feed_provider`, `chat_provider`) listen to it: a `dev.event` goes on top of the feed, a
  `dev.chat.message` into the open thread or the conversation list.
- **Push**: `services/push_service.dart` registers the FCM token with `POST /api/app/devices` and `app: 'dev'`;
  a tap on a push routes by its `deeplink` (`feed`, `chat/<id>`, `ticket/<id>`). The server sends ordinary
  notification messages, so no background handler is needed. Sign-out deletes the token.
- **Tabs**: Live (numbers + feed, filters, "N new"), Chats (conversations, unread badge, start one with any
  reader), Tickets (the support desk, needs `support.manage`), Settings (push on/off, types left out of pushes).

## Setup the owner has to do

Nothing secret is in the repository (`google-services.json`, `GoogleService-Info.plist`, `key.properties`, `*.jks` are gitignored).

1. **Firebase** — project **`ramkrishnahari-e6e48`**, the one the production API sends push and checks App Check with
   (this app talks to production by default, so it has to be registered where production looks; the local backend's
   `hari-hari-bol` is a different project). Sign the Firebase CLI in as the project's owner (`firebase login:add`;
   `firebase login:list` must show them and `firebase projects:list` must list the project), then run
   **`tool/setup_firebase.sh`**. It registers an Android and an iOS app for `com.sss.hariharibol.dev`, registers the
   debug and release SHA-1/SHA-256 for Android, writes `android/app/google-services.json` and
   `ios/Runner/GoogleService-Info.plist`, and adds the Google sign-in URL scheme to `ios/Runner/Info.plist`. Safe to
   run again (`FIREBASE_PROJECT=<id>` for another project). What no CLI can do, in the consoles:
   - **App Check → Apps**: register both apps (Play Integrity, App Attest) — the sign-in endpoint refuses clients it
     does not know in production — and add the debug token a debug build prints.
   - **Cloud Messaging → Apple app configuration**: the APNs key the reader app uses covers this app too.
   - **Apple Developer → Identifiers → `com.sss.hariharibol.dev`**: Push Notifications and App Attest.
2. **Google sign-in**: the API accepts an ID token only when its audience is in `GOOGLE_CLIENT_IDS`. Build with
   `--dart-define=GOOGLE_SERVER_CLIENT_ID=<the web client id>` (the same one the reader app uses, in the setup script's
   output) on **both** platforms and the audience is that web client, which production already lists. Without it,
   iOS signs with its own client id (the plist's `CLIENT_ID`), which is new for this bundle id and must be added to the
   server's list first (a missing id fails as `UNAUTHENTICATED`, and the API logs `google id token rejected` with the
   audience it saw).
3. **Release signing**: Android is done — `android/app/key.jks` and `android/key.properties` (alias `hariharibol-dev`,
   valid to 2056), backed up in `../hariharibol-local-secrets/hariharibol-dev/`; without them a release build falls
   back to the debug key. Nothing has been uploaded to Play, so this key is replaceable until it is. **The iOS team is
   not set** (`DEVELOPMENT_TEAM` empty): choose one in Xcode locally, or set the same one as `app/` once confirmed.
4. **Backend**: run `prisma migrate deploy` (grants `dev.access` to `super_admin`); to let another person in, add
   `dev.access` to their role in the admin panel → Roles. Restart API, worker and websocket.

**Push channels (Android).** The API names a channel in every push — `default` for criticals, `updates` for the rest
(`backend/utils/push-message.js`). `MainActivity` creates both at launch (Alerts: high, Updates: low); without them
Android 8+ shows every push on a generic fallback channel and the loud/quiet split is lost. The small icon
(`ic_stat_bell.xml`) is a single-colour bell tinted `notification_accent`, which must equal `AppColors.seed`.

Run against a laptop:
`flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000 --dart-define=WS_URL=ws://10.0.2.2:4001/ws`.

## State

`flutter analyze` is clean and `flutter test` passes (the websocket client against a fake channel, push routing,
models, the feed's building blocks). **It has not been built for Android or iOS, nor run on a device**: there was no
Android SDK or Xcode where it was written, so the Gradle changes (the optional google-services plugin, AGP 9), the
iOS entitlements and project settings, real push delivery and the Google sheet are untried. The 11-language
question does not arise (English only).
