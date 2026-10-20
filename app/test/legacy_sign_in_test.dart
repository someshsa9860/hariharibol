// Signing in someone who updated from the previous app, without asking them to.
//
// That app left its access token on the phone, where this one (same bundle id)
// can read it. At launch the token is sent to the API, which has the old server
// say who it belongs to and answers with a session of this app's own.
//
// The tests are mostly about the token, because it is the person's way in: it
// must go the moment it has been traded, and the moment the API says it will
// never work — and it must NOT go because the network was down, the server was
// busy or a proxy said something. A bad moment cannot cost anyone their account.
//
// The server is a scripted `HttpClientAdapter`; the preferences, the secure
// store and Hive are the real ones over their test doubles.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:hariharibol/core/constants/api_paths.dart';
import 'package:hariharibol/core/constants/app_config.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/core/session/app_session.dart';
import 'package:hariharibol/core/session/legacy_token_store.dart';
import 'package:hariharibol/core/session/token_store.dart';
import 'package:hariharibol/models/auth_session.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/auth_service.dart';
import 'package:hariharibol/services/legacy_sign_in.dart';
import 'package:hariharibol/services/local_store.dart';

/// A token of the old server: `id|secret`, the shape Sanctum issues.
const _legacyToken = '412|Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MA';

const _newAccess = 'new-access-token-0000000000';
const _newRefresh = 'new-refresh-token-0000000000';

Map<String, dynamic> _sessionBody({String email = 'devotee@example.com'}) => {
      'success': true,
      'data': {
        'user': {
          'id': 'usr_legacy_1',
          'email': email,
          'name': 'Test Devotee',
          'authProvider': 'LEGACY',
          'appLanguage': 'en',
          'mantraLanguage': 'sa',
          'readingLanguage': 'en',
          'timezone': 'Asia/Kolkata',
          'isPremium': false,
          'role': 'user',
        },
        'tokens': {
          'accessToken': _newAccess,
          'refreshToken': _newRefresh,
          'refreshExpiresAt':
              DateTime.now().add(const Duration(days: 365)).toUtc().toIso8601String(),
        },
      },
    };

Map<String, dynamic> _errorBody(String code) => {
      'success': false,
      'error': {'code': code, 'message': 'x'},
    };

/// One answer the fake server gives.
class _Answer {
  const _Answer(this.status, [this.body = const {}, this.after = Duration.zero]);

  /// No route to the server.
  static _Answer offline() => const _Answer(0);

  /// The connection was made and nothing came back in time.
  static _Answer timedOut() => const _Answer(-1);

  final int status;
  final Object body;

  /// How long the server sits on the request before it answers.
  final Duration after;
}

class _Server implements HttpClientAdapter {
  _Server(this.answer);

  final _Answer Function(RequestOptions request) answer;
  final List<RequestOptions> requests = [];

  List<RequestOptions> to(String path) => requests.where((r) => r.path == path).toList();

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final reply = answer(options);

    if (reply.after > Duration.zero) {
      final cancelled = cancelFuture?.then((_) => true);
      final gaveUp = await Future.any<bool>([
        Future<void>.delayed(reply.after).then((_) => false),
        ?cancelled,
      ]);
      if (gaveUp) throw DioException.requestCancelled(requestOptions: options, reason: 'cancelled');
    } else {
      // Real network time, as the other client tests give it.
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }

    if (reply.status == 0) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        error: const SocketException('Network is unreachable'),
      );
    }
    if (reply.status == -1) {
      throw DioException(requestOptions: options, type: DioExceptionType.receiveTimeout);
    }

    return ResponseBody.fromString(
      reply.body is String ? reply.body as String : jsonEncode(reply.body),
      reply.status,
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
    hiveDir = await Directory.systemTemp.createTemp('hariharibol_legacy_test');
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
    await LocalStore.instance.clear();
    await AppSession.instance.clear();
    SharedPreferences.setMockInitialValues({});
  });

  /// What the previous app left in the plugin's store.
  void previousAppLeft(Object? token) =>
      SharedPreferences.setMockInitialValues({LegacyKeys.token: ?token});

  Future<String?> tokenOnPhone() async =>
      (await SharedPreferences.getInstance()).getString(LegacyKeys.token);

  ({LegacySignIn signIn, _Server server}) launchWith(
    _Answer Function(RequestOptions request) answer, {
    Duration timeout = AppConfig.legacySignInTimeout,
  }) {
    final server = _Server(answer);
    final auth = AuthService.forTesting(api: ApiClient.forTesting(adapter: server));
    return (signIn: LegacySignIn.forTesting(auth: auth, timeout: timeout), server: server);
  }

  group('the token the previous app left', () {
    const store = LegacyTokenStore();

    test('is read from where that app kept it', () async {
      previousAppLeft(_legacyToken);

      expect(await store.read(), _legacyToken);
    });

    test('is null when there is none', () async {
      expect(await store.read(), isNull);
    });

    test('is null when it could not be one — the API takes 10 to 300 characters', () async {
      previousAppLeft('x' * (AppConfig.legacyTokenMinLength - 1));
      expect(await store.read(), isNull);

      previousAppLeft('x' * AppConfig.legacyTokenMinLength);
      expect(await store.read(), isNotNull);

      previousAppLeft('x' * AppConfig.legacyTokenMaxLength);
      expect(await store.read(), isNotNull);

      previousAppLeft('x' * (AppConfig.legacyTokenMaxLength + 1));
      expect(await store.read(), isNull);
    });

    test('loses the whitespace around it', () async {
      previousAppLeft('  $_legacyToken\n');

      expect(await store.read(), _legacyToken);
    });

    test('is null, not an error, when the slot holds something else', () async {
      previousAppLeft(12345678901234);

      expect(await store.read(), isNull);
    });

    test('is removed by clear, and clear touches nothing else', () async {
      SharedPreferences.setMockInitialValues({LegacyKeys.token: _legacyToken, 'other': 'kept'});

      await store.clear();

      final preferences = await SharedPreferences.getInstance();
      expect(preferences.containsKey(LegacyKeys.token), isFalse);
      expect(preferences.getString('other'), 'kept');
    });

    test('clear with nothing there is not an error', () async {
      await store.clear();

      expect(await store.read(), isNull);
    });
  });

  group('signing someone in with it', () {
    test('trades it for a session of this app\'s own', () async {
      previousAppLeft(_legacyToken);
      final launch = launchWith((_) => _Answer(201, _sessionBody()));

      final signedIn = await launch.signIn.run();

      expect(signedIn, isTrue);
      expect(AppSession.instance.isSignedIn, isTrue);
      expect(AppSession.instance.accessToken, _newAccess);
      expect(AppSession.instance.refreshToken, _newRefresh);
      expect(AppSession.instance.user?.id, 'usr_legacy_1');

      // Kept the way every session is: in the secure store, under the app's own keys.
      final stored = await const TokenStore().read();
      expect(stored?.accessToken, _newAccess);
      expect(stored?.refreshToken, _newRefresh);

      // And the old token has done its work.
      expect(await tokenOnPhone(), isNull);
    });

    test('sends the token and the usual sign-in fields, and no bearer', () async {
      previousAppLeft(_legacyToken);
      final launch = launchWith((_) => _Answer(200, _sessionBody()));

      await launch.signIn.run();

      final request = launch.server.to(ApiPaths.signInLegacy).single;
      final body = request.data as Map<String, dynamic>;
      expect(body['legacyToken'], _legacyToken);
      expect(body['appLanguage'], AppConfig.defaultAppLanguage);
      expect(body['timezone'], isNotEmpty);
      expect(request.headers['Authorization'], isNull);
    });

    test('a new account goes through the language picker, a returning one does not', () async {
      previousAppLeft(_legacyToken);
      await launchWith((_) => _Answer(201, _sessionBody())).signIn.run();
      expect(LocalStore.instance.read<bool>(BoxKeys.onboardingSeen), isFalse);

      await AppSession.instance.clear();
      previousAppLeft(_legacyToken);
      await launchWith((_) => _Answer(200, _sessionBody())).signIn.run();
      expect(LocalStore.instance.read<bool>(BoxKeys.onboardingSeen), isTrue);
    });

    test('an account with no address of its own is signed in all the same', () async {
      previousAppLeft(_legacyToken);
      final launch = launchWith((_) => _Answer(201, _sessionBody(email: '')));

      expect(await launch.signIn.run(), isTrue);
      expect(AppSession.instance.user?.email, isEmpty);
    });

    test('leaves a phone that is already signed in alone', () async {
      previousAppLeft(_legacyToken);
      await AppSession.instance.start(AuthSession.fromJson(_sessionBody()['data'] as Map<String, dynamic>));
      final launch = launchWith((_) => _Answer(200, _sessionBody()));

      expect(await launch.signIn.run(), isFalse);

      expect(launch.server.requests, isEmpty);
      expect(await tokenOnPhone(), _legacyToken);
    });

    test('does nothing at all without a token', () async {
      final launch = launchWith((_) => _Answer(200, _sessionBody()));

      expect(await launch.signIn.run(), isFalse);

      expect(launch.server.requests, isEmpty);
      expect(AppSession.instance.isSignedIn, isFalse);
    });

    test('does nothing with a token the API would refuse outright', () async {
      previousAppLeft('short');
      final launch = launchWith((_) => _Answer(200, _sessionBody()));

      expect(await launch.signIn.run(), isFalse);

      expect(launch.server.requests, isEmpty);
    });
  });

  group('when the API says the token will never work', () {
    test('403 UNAUTHENTICATED — the old server does not know it — removes it', () async {
      previousAppLeft(_legacyToken);
      final launch = launchWith((_) => _Answer(403, _errorBody('UNAUTHENTICATED')));

      expect(await launch.signIn.run(), isFalse);

      expect(await tokenOnPhone(), isNull);
      expect(AppSession.instance.isSignedIn, isFalse);
      // A refusal here is not "your session lapsed": there is nothing to refresh.
      expect(launch.server.requests, hasLength(1));
      expect(launch.server.to(ApiPaths.refresh), isEmpty);
    });

    test('409 CONFLICT — the account signs in another way now — removes it', () async {
      previousAppLeft(_legacyToken);
      final launch = launchWith((_) => _Answer(409, _errorBody('CONFLICT')));

      expect(await launch.signIn.run(), isFalse);

      expect(await tokenOnPhone(), isNull);
      expect(AppSession.instance.isSignedIn, isFalse);
    });
  });

  group('when nothing is known about the token', () {
    // Each of these is a bad moment, not a verdict: the token has to be there at
    // the next launch.
    final moments = <String, _Answer Function()>{
      'no connection': _Answer.offline,
      'the server timing out': _Answer.timedOut,
      'a busy server (429)': () => _Answer(429, _errorBody('RATE_LIMITED')),
      'a broken server (500)': () => _Answer(500, _errorBody('INTERNAL')),
      'the old server being unreachable (503)': () => _Answer(503, _errorBody('LEGACY_UNAVAILABLE')),
      'a refused attestation (403 FORBIDDEN)': () => _Answer(403, _errorBody('FORBIDDEN')),
      'a refused request (400)': () => _Answer(400, _errorBody('BAD_REQUEST')),
      'a proxy\'s bare 401': () => const _Answer(401, '<html>nope</html>'),
      'a gateway\'s bare 409': () => const _Answer(409, '<html>nope</html>'),
      'a proxy\'s 403 page': () => const _Answer(403, '<html>nope</html>'),
    };

    for (final moment in moments.entries) {
      test('${moment.key} keeps it and signs nobody in', () async {
        previousAppLeft(_legacyToken);
        final launch = launchWith((_) => moment.value());

        expect(await launch.signIn.run(), isFalse);

        expect(await tokenOnPhone(), _legacyToken);
        expect(AppSession.instance.isSignedIn, isFalse);
      });
    }

    test('a 200 that is not a session keeps it and signs nobody in', () async {
      previousAppLeft(_legacyToken);
      final launch = launchWith((_) => const _Answer(200, {'success': true, 'data': {}}));

      expect(await launch.signIn.run(), isFalse);

      expect(await tokenOnPhone(), _legacyToken);
      expect(AppSession.instance.isSignedIn, isFalse);
    });

    test('a reply that takes too long is given up on, and keeps it', () async {
      previousAppLeft(_legacyToken);
      final launch = launchWith(
        (_) => _Answer(201, _sessionBody(), const Duration(seconds: 5)),
        timeout: const Duration(milliseconds: 80),
      );

      final started = DateTime.now();
      expect(await launch.signIn.run(), isFalse);

      expect(DateTime.now().difference(started), lessThan(const Duration(seconds: 2)));
      expect(await tokenOnPhone(), _legacyToken);
      expect(AppSession.instance.isSignedIn, isFalse);
    });

    test('a reply that comes after it was given up on starts nothing', () async {
      previousAppLeft(_legacyToken);
      final launch = launchWith(
        (_) => _Answer(201, _sessionBody(), const Duration(milliseconds: 400)),
        timeout: const Duration(milliseconds: 60),
      );

      await launch.signIn.run();
      await Future<void>.delayed(const Duration(milliseconds: 500));

      expect(AppSession.instance.isSignedIn, isFalse);
      expect(await const TokenStore().read(), isNull);
    });
  });

  group('signing out is final', () {
    // The previous app's token could otherwise sign someone straight back in at
    // the next launch: they chose to leave, and an old token is not a reason to
    // let them in again.
    test('signing out removes a token the sign-in did not use', () async {
      previousAppLeft(_legacyToken);
      await AppSession.instance.start(AuthSession.fromJson(_sessionBody()['data'] as Map<String, dynamic>));
      final server = _Server((_) => const _Answer(200, {'success': true}));
      final auth = AuthService.forTesting(api: ApiClient.forTesting(adapter: server));

      await auth.signOut();

      expect(AppSession.instance.isSignedIn, isFalse);
      expect(await tokenOnPhone(), isNull);
    });

    test('and so does deleting the account', () async {
      previousAppLeft(_legacyToken);
      await AppSession.instance.start(AuthSession.fromJson(_sessionBody()['data'] as Map<String, dynamic>));
      final server = _Server((_) => const _Answer(200, {'success': true}));
      final auth = AuthService.forTesting(api: ApiClient.forTesting(adapter: server));

      await auth.deleteAccount();

      expect(AppSession.instance.isSignedIn, isFalse);
      expect(await tokenOnPhone(), isNull);
    });
  });
}
