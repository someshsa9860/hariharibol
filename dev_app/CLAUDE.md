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

Nothing secret is in the repository (`google-services.json`, `GoogleService-Info.plist` are gitignored).

1. **Firebase**: add an Android app `com.sss.hariharibol.dev` and an iOS app `com.sss.hariharibol.dev` to the
   existing Firebase project; put `google-services.json` in `android/app/` and `GoogleService-Info.plist` in
   `ios/Runner/`. Upload the APNs key (already there for the reader app) — it covers both iOS apps. Register the
   app with **App Check** (Play Integrity / App Attest) — the sign-in endpoint refuses clients it does not
   know in production. Add the debug token for debug builds.
2. **Google sign-in**: add the Android SHA-1 of the dev app's keystore, and an iOS client id. Build with
   `--dart-define=GOOGLE_SERVER_CLIENT_ID=<the web client id>` (the same one the reader app uses) and, on iOS,
   `GOOGLE_IOS_CLIENT_ID`.
3. **Release signing**: Android signing config and the iOS team are not set (debug signing, no team). Do them the way
   `app/` does ("Firebase and signing").
4. **Backend**: run `prisma migrate deploy` (grants `dev.access` to `super_admin`); to let another person in, add
   `dev.access` to their role in the admin panel → Roles. Restart API, worker and websocket.

Run against a laptop:
`flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000 --dart-define=WS_URL=ws://10.0.2.2:4001/ws`.

## State

`flutter analyze` is clean and `flutter test` passes (the websocket client against a fake channel, push routing,
models, the feed's building blocks). **It has not been built for Android or iOS, nor run on a device**: there was no
Android SDK or Xcode where it was written, so the Gradle changes (the optional google-services plugin, AGP 9), the
iOS entitlements and project settings, real push delivery and the Google sheet are untried. The 11-language
question does not arise (English only).
