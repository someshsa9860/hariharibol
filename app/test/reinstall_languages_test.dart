// Reinstalling the app and signing in to the same account.
//
// The languages are kept on the phone, so a fresh install holds none. An account
// that already exists chose its app and reading languages before, and those come
// back from the backend; a brand-new account has only the defaults and is still
// sent to the picker. The server is a scripted `HttpClientAdapter`; Hive and the
// secure store are the real ones over their test doubles.

import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/core/session/app_session.dart';
import 'package:hariharibol/providers/language_settings_provider.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/auth_service.dart';
import 'package:hariharibol/services/local_store.dart';

Map<String, dynamic> _sessionBody({required String app, required String reading, String mantra = 'sa'}) => {
      'success': true,
      'data': {
        'user': {
          'id': 'usr_reinstall_1',
          'email': 'devotee@example.com',
          'name': 'Test Devotee',
          'authProvider': 'GOOGLE',
          'appLanguage': app,
          'mantraLanguage': mantra,
          'readingLanguage': reading,
          'timezone': 'Asia/Kolkata',
          'isPremium': false,
          'role': 'user',
        },
        'tokens': {
          'accessToken': 'a' * 40,
          'refreshToken': 'r' * 40,
          'refreshExpiresAt': DateTime.now().add(const Duration(days: 365)).toUtc().toIso8601String(),
        },
      },
    };

/// Answers every request with one status and body.
class _Server implements HttpClientAdapter {
  _Server(this.status, this.body);

  final int status;
  final Object body;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    await Future<void>.delayed(const Duration(milliseconds: 5));
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory hiveDir;

  setUpAll(() async {
    hiveDir = await Directory.systemTemp.createTemp('hariharibol_reinstall_test');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => hiveDir.path,
    );
    await LocalStore.instance.init();
  });

  tearDownAll(() async {
    await Hive.close();
    if (hiveDir.existsSync()) hiveDir.deleteSync(recursive: true);
  });

  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.clear();
    await AppSession.instance.clear();
  });

  /// Signs in over a server that answers [status] with this account.
  Future<void> signIn(int status, {required String app, required String reading}) {
    final server = _Server(status, _sessionBody(app: app, reading: reading));
    final auth = AuthService.forTesting(api: ApiClient.forTesting(adapter: server));
    return auth.signInWithLegacyToken('412|Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MA');
  }

  ProviderContainer container() {
    final c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  group('an account that already exists', () {
    test('brings its app and reading languages to a phone that holds none', () async {
      // The app is up and its languages are built before anyone has signed in.
      final c = container();
      c.listen(languageSettingsProvider, (_, _) {});
      expect(LocalStore.instance.read<String>(BoxKeys.languageReading), isNull);

      await signIn(200, app: 'hi', reading: 'hi');
      await Future<void>.delayed(Duration.zero);

      final settings = c.read(languageSettingsProvider);
      expect(settings.app, 'hi');
      expect(settings.reading, 'hi');
      expect(LocalStore.instance.read<String>(BoxKeys.languageApp), 'hi');
      expect(LocalStore.instance.read<String>(BoxKeys.languageReading), 'hi');
    });

    test('keeps app and reading apart when the account holds two different ones', () async {
      final c = container();
      c.listen(languageSettingsProvider, (_, _) {});

      await signIn(200, app: 'en', reading: 'mr');
      await Future<void>.delayed(Duration.zero);

      expect(c.read(languageSettingsProvider).app, 'en');
      expect(c.read(languageSettingsProvider).reading, 'mr');
    });

    test('is not sent to the language picker', () async {
      await signIn(200, app: 'hi', reading: 'hi');

      expect(LocalStore.instance.read<bool>(BoxKeys.onboardingSeen), isTrue);
    });

    test('replaces what another account left on the phone', () async {
      await LocalStore.instance.write(BoxKeys.languageApp, 'ta');
      await LocalStore.instance.write(BoxKeys.languageReading, 'ta');
      final c = container();
      c.listen(languageSettingsProvider, (_, _) {});
      expect(c.read(languageSettingsProvider).reading, 'ta');

      await signIn(200, app: 'hi', reading: 'hi');
      await Future<void>.delayed(Duration.zero);

      expect(c.read(languageSettingsProvider).reading, 'hi');
    });

    test('leaves the speaking language, which the account does not hold, alone', () async {
      await LocalStore.instance.write(BoxKeys.languageSpeaking, 'gu');
      final c = container();
      c.listen(languageSettingsProvider, (_, _) {});

      await signIn(200, app: 'hi', reading: 'hi');
      await Future<void>.delayed(Duration.zero);

      expect(c.read(languageSettingsProvider).speaking, 'gu');
    });
  });

  group('a brand-new account', () {
    test('keeps what the phone had and is sent to the picker', () async {
      final c = container();
      c.listen(languageSettingsProvider, (_, _) {});
      final before = c.read(languageSettingsProvider);

      // The backend gives a new account the defaults it was sent, here 'ta' to
      // tell them apart from the phone's.
      await signIn(201, app: 'ta', reading: 'ta');
      await Future<void>.delayed(Duration.zero);

      expect(c.read(languageSettingsProvider), before);
      expect(LocalStore.instance.read<String>(BoxKeys.languageApp), isNull);
      expect(LocalStore.instance.read<String>(BoxKeys.languageReading), isNull);
      expect(LocalStore.instance.read<bool>(BoxKeys.onboardingSeen), isFalse);
    });
  });

  group('the choice made afterwards', () {
    test('still wins and is kept', () async {
      final c = container();
      c.listen(languageSettingsProvider, (_, _) {});
      await signIn(200, app: 'hi', reading: 'hi');
      await Future<void>.delayed(Duration.zero);

      // A signed-in change is also sent to the account through the real client,
      // which a test must not reach; what is asserted here is the device's side.
      await AppSession.instance.clear();
      await c.read(languageSettingsProvider.notifier).setReading('mr');

      expect(c.read(languageSettingsProvider).reading, 'mr');
      expect(c.read(languageSettingsProvider).app, 'hi');
      expect(LocalStore.instance.read<String>(BoxKeys.languageReading), 'mr');
    });
  });
}
