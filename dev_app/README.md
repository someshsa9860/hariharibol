# HariHariBol Dev

The owner's companion app — live server alerts, new sign-ups, feedback and tickets, and chat with readers.
Rules, structure and the setup you have to do (Firebase for `com.sss.hariharibol.dev`, Google client ids,
signing) are in [CLAUDE.md](CLAUDE.md).

```
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000 --dart-define=WS_URL=ws://10.0.2.2:4001/ws
flutter test
```
