# HariHariBol — mobile app

Flutter, iOS and Android. Rules live in [CLAUDE.md](CLAUDE.md).

## Running it

The SDK on `PATH` is too old. Use 3.44.2:

```bash
export PATH="/Users/teja/company/flutter-versions/flutter_3.44.2/bin:$PATH"
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

`10.0.2.2` is how an Android emulator reaches the machine it is running on. On
an iOS simulator use `http://localhost:4000`; on a physical device use the
laptop's LAN address. With no define at all the app talks to production.

Start the API first — `cd ../backend && npm run dev`.

## What works today

Sign-in (Google and Apple) → the dashboard, which loads from `/api/app/home`,
and the profile tab, which can sign out and delete the account. The sadhana and
library tabs are routed and empty.

## What is not wired yet

- **Firebase.** No `google-services.json` / `GoogleService-Info.plist` in the
  repo — they are secrets, backed up outside it. Until they are dropped in,
  push, analytics and App Check are inert by design, and the app runs anyway.
- **Google sign-in on Android** needs `GOOGLE_SERVER_CLIENT_ID` (the *web*
  client id) or Google returns no ID token for the backend to verify.
- **Offline storage.** Drift is a dependency but there are no tables yet.

## Checks

```bash
flutter analyze
flutter test
```
