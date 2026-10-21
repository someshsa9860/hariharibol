// How the app keeps someone signed in, and the one thing that signs them out.
//
// The server says "I do not know you" with a 403 whose code is UNAUTHENTICATED.
// The client answers that by swapping the refresh token for a new pair and
// replaying the call. Everything below is about what happens when that goes
// well, and — more to the point — when it does not: a dead network, a timeout, a
// 5xx, a 429 or a page from a proxy must leave the person signed in with the
// refresh token untouched. Only the server saying 403 to the refresh itself ends
// a session.
//
// The server is a scripted `HttpClientAdapter`, so every request the client
// makes is on record and every answer is chosen by the test.

import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

import 'package:hariharibol/core/constants/api_paths.dart';
import 'package:hariharibol/core/constants/app_config.dart';
import 'package:hariharibol/core/session/app_session.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/auth_session.dart';
import 'package:hariharibol/services/api_client.dart';
import 'package:hariharibol/services/local_store.dart';

const _data = '/api/app/something';

/// A token shaped like the server's: three base64url parts, the middle one
/// carrying `iat` and `exp`. The signature is never checked on the phone.
String jwt({required DateTime issued, Duration lifetime = const Duration(days: 7), String? salt}) {
  String part(Object value) => base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return [
    part({'alg': 'HS256', 'typ': 'JWT'}),
    part({
      'sub': 'usr_1',
      'typ': 'access',
      'iat': issued.millisecondsSinceEpoch ~/ 1000,
      'exp': issued.add(lifetime).millisecondsSinceEpoch ~/ 1000,
      'salt': ?salt,
    }),
    'signature',
  ].join('.');
}

AuthTokens tokensIssued(DateTime issued, {String refresh = 'old-refresh-token-0000000000'}) =>
    AuthTokens(
      accessToken: jwt(issued: issued, salt: 'old'),
      refreshToken: refresh,
      refreshExpiresAt: DateTime.now().add(const Duration(days: 365)),
    );

Map<String, dynamic> userJson() => {
      'id': 'usr_1',
      'email': 'user@smoke.test',
      'name': 'Test Devotee',
      'authProvider': 'GOOGLE',
      'appLanguage': 'en',
      'mantraLanguage': 'sa',
      'readingLanguage': 'en',
      'timezone': 'Asia/Kolkata',
      'isPremium': false,
      'role': 'user',
    };

/// What the server returns from a successful refresh.
Map<String, dynamic> renewed({required String access, String refresh = 'new-refresh-token-0000000000'}) => {
      'success': true,
      'data': {
        'user': userJson(),
        'tokens': {
          'accessToken': access,
          'refreshToken': refresh,
          'refreshExpiresAt': DateTime.now().add(const Duration(days: 365)).toUtc().toIso8601String(),
        },
      },
    };

Map<String, dynamic> errorBody(String code) => {
      'success': false,
      'error': {'code': code, 'message': 'x'},
    };

const ok = {'success': true, 'data': {'fine': true}};

/// One answer the fake server gives.
class Reply {
  const Reply(this.status, [this.body = const {}]);

  /// The network is down: the request never reaches a server.
  static Reply offline() => const Reply(0);

  /// The server took too long.
  static Reply slow() => const Reply(-1);

  final int status;
  final Object body;
}

class Recorded {
  Recorded(this.path, this.bearer, this.data);

  final String path;
  final String? bearer;
  final Object? data;
}

class ScriptedServer implements HttpClientAdapter {
  ScriptedServer(this.answer);

  /// Chooses the reply to a request; sees every request in order.
  final Reply Function(Recorded request) answer;

  final List<Recorded> requests = [];

  List<Recorded> to(String path) => requests.where((r) => r.path == path).toList();

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final request = Recorded(
      options.path,
      options.headers['Authorization'] as String?,
      options.data,
    );
    requests.add(request);

    // Real network time, so requests started together overlap.
    await Future<void>.delayed(const Duration(milliseconds: 5));

    final reply = answer(request);
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

    final text = reply.body is String ? reply.body as String : jsonEncode(reply.body);
    return ResponseBody.fromString(
      text,
      reply.status,
      headers: {
        Headers.contentTypeHeader: [reply.body is String ? 'text/event-stream' : Headers.jsonContentType],
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
    hiveDir = await Directory.systemTemp.createTemp('hariharibol_auth_test');
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

  /// Signed in with an access token [age] old and the refresh token "old".
  Future<AuthTokens> signedInWith({Duration age = const Duration(hours: 1)}) async {
    FlutterSecureStorage.setMockInitialValues({});
    await LocalStore.instance.clear();
    final tokens = tokensIssued(DateTime.now().subtract(age));
    await AppSession.instance.start(
      AuthSession.fromJson({
        'user': userJson(),
        'tokens': {
          'accessToken': tokens.accessToken,
          'refreshToken': tokens.refreshToken,
          'refreshExpiresAt': tokens.refreshExpiresAt!.toUtc().toIso8601String(),
        },
      }),
    );
    return tokens;
  }

  group('an access token that has lapsed', () {
    test('is renewed with the refresh token and the call is replayed', () async {
      final tokens = await signedInWith();
      final fresh = jwt(issued: DateTime.now(), salt: 'fresh');
      final server = ScriptedServer((r) {
        if (r.path == ApiPaths.refresh) return Reply(200, renewed(access: fresh));
        return r.bearer == 'Bearer $fresh' ? const Reply(200, ok) : Reply(403, errorBody('UNAUTHENTICATED'));
      });
      final client = ApiClient.forTesting(adapter: server);

      final response = await client.get(_data);

      expect(response.json['fine'], isTrue);
      expect(server.to(ApiPaths.refresh), hasLength(1));
      expect(
        (server.to(ApiPaths.refresh).single.data as Map)['refreshToken'],
        tokens.refreshToken,
        reason: 'the refresh token is what proves who is asking',
      );
      expect(server.to(_data), hasLength(2), reason: 'once refused, once replayed');
      expect(AppSession.instance.accessToken, fresh);
      expect(AppSession.instance.refreshToken, 'new-refresh-token-0000000000');
      expect(AppSession.instance.isSignedIn, isTrue);
    });

    test('several calls failing together share one refresh', () async {
      await signedInWith();
      final fresh = jwt(issued: DateTime.now(), salt: 'fresh');
      final server = ScriptedServer((r) {
        if (r.path == ApiPaths.refresh) return Reply(200, renewed(access: fresh));
        return r.bearer == 'Bearer $fresh' ? const Reply(200, ok) : Reply(403, errorBody('UNAUTHENTICATED'));
      });
      final client = ApiClient.forTesting(adapter: server);

      final results = await Future.wait([client.get(_data), client.get(_data), client.get(_data)]);

      expect(results.every((r) => r.json['fine'] == true), isTrue);
      expect(server.to(ApiPaths.refresh), hasLength(1), reason: 'a spent refresh token cannot be used twice');
    });

    test('a 401, as an older server says it, is renewed the same way', () async {
      await signedInWith();
      final fresh = jwt(issued: DateTime.now(), salt: 'fresh');
      final server = ScriptedServer((r) {
        if (r.path == ApiPaths.refresh) return Reply(200, renewed(access: fresh));
        return r.bearer == 'Bearer $fresh' ? const Reply(200, ok) : Reply(401, errorBody('UNAUTHORIZED'));
      });

      final response = await ApiClient.forTesting(adapter: server).get(_data);

      expect(response.json['fine'], isTrue);
    });

    test('a refused stream is renewed and replayed too', () async {
      await signedInWith();
      final fresh = jwt(issued: DateTime.now(), salt: 'fresh');
      final server = ScriptedServer((r) {
        if (r.path == ApiPaths.refresh) return Reply(200, renewed(access: fresh));
        return r.bearer == 'Bearer $fresh'
            ? const Reply(200, 'event: delta\ndata: {"text":"Hare"}\n\n')
            : Reply(403, errorBody('UNAUTHENTICATED'));
      });

      final stream = await ApiClient.forTesting(adapter: server).postEventStream('/api/app/chat/x');
      final events = await stream.toList();

      expect(events.single.data, '{"text":"Hare"}');
      expect(server.to(ApiPaths.refresh), hasLength(1));
    });

    test('a replay that is refused again does not start another refresh', () async {
      await signedInWith();
      final server = ScriptedServer((r) {
        if (r.path == ApiPaths.refresh) {
          return Reply(200, renewed(access: jwt(issued: DateTime.now(), salt: 'fresh')));
        }
        return Reply(403, errorBody('UNAUTHENTICATED'));
      });

      await expectLater(
        ApiClient.forTesting(adapter: server).get(_data),
        throwsA(isA<ApiFailure>().having((f) => f.kind, 'kind', FailureKind.unauthorized)),
      );

      expect(server.to(ApiPaths.refresh), hasLength(1));
      expect(AppSession.instance.isSignedIn, isTrue, reason: 'the refresh worked; only this call is refused');
    });
  });

  group('the server refusing the refresh signs the person out', () {
    test('403 UNAUTHENTICATED on the refresh clears the session', () async {
      await signedInWith();
      final server = ScriptedServer((r) => Reply(403, errorBody('UNAUTHENTICATED')));

      await expectLater(
        ApiClient.forTesting(adapter: server).get(_data),
        throwsA(isA<ApiFailure>().having((f) => f.kind, 'kind', FailureKind.unauthorized)),
      );

      expect(AppSession.instance.status, SessionStatus.signedOut);
      expect(AppSession.instance.refreshToken, isNull);
    });

    test('a newer sign-in is not cleared by an older refresh being refused', () async {
      await signedInWith();
      final server = ScriptedServer((r) {
        if (r.path == ApiPaths.refresh) {
          // Someone signs in again while the refresh is on its way.
          AppSession.instance.start(
            AuthSession.fromJson({
              'user': userJson(),
              'tokens': {
                'accessToken': jwt(issued: DateTime.now(), salt: 'newer'),
                'refreshToken': 'newer-sign-in-refresh-0000',
                'refreshExpiresAt': DateTime.now().add(const Duration(days: 365)).toUtc().toIso8601String(),
              },
            }),
          );
          return Reply(403, errorBody('UNAUTHENTICATED'));
        }
        return Reply(403, errorBody('UNAUTHENTICATED'));
      });

      await expectLater(ApiClient.forTesting(adapter: server).get(_data), throwsA(isA<ApiFailure>()));

      expect(AppSession.instance.isSignedIn, isTrue);
      expect(AppSession.instance.refreshToken, 'newer-sign-in-refresh-0000');
    });
  });

  group('nothing else signs the person out', () {
    /// A server that refuses the data call as unauthenticated and answers the
    /// refresh with [reply].
    Future<ApiFailure> failsWith(Reply reply) async {
      final tokens = await signedInWith();
      final server = ScriptedServer((r) {
        if (r.path == ApiPaths.refresh) return reply;
        return Reply(403, errorBody('UNAUTHENTICATED'));
      });

      ApiFailure? caught;
      try {
        await ApiClient.forTesting(adapter: server).get(_data);
      } on ApiFailure catch (failure) {
        caught = failure;
      }

      expect(AppSession.instance.isSignedIn, isTrue, reason: 'still signed in');
      expect(AppSession.instance.refreshToken, tokens.refreshToken, reason: 'the token is kept for the next try');
      expect(AppSession.instance.accessToken, tokens.accessToken);
      expect(caught, isNotNull);
      return caught!;
    }

    test('no network', () async {
      final failure = await failsWith(Reply.offline());
      expect(failure.kind, FailureKind.network);
    });

    test('a timeout', () async {
      final failure = await failsWith(Reply.slow());
      expect(failure.kind, FailureKind.timeout);
    });

    test('a server error', () async {
      final failure = await failsWith(Reply(500, errorBody('SERVER_ERROR')));
      expect(failure.kind, FailureKind.server);
    });

    test('a bad gateway page from a proxy', () async {
      final failure = await failsWith(const Reply(502, '<html>Bad Gateway</html>'));
      expect(failure.kind, FailureKind.server);
    });

    test('too many requests', () async {
      final failure = await failsWith(Reply(429, errorBody('RATE_LIMITED')));
      expect(failure.kind, FailureKind.rateLimited);
    });

    test('a 403 that is not the server\'s own (no UNAUTHENTICATED code)', () async {
      await failsWith(const Reply(403, '<html>Blocked</html>'));
    });

    test('a 200 with nothing usable in it', () async {
      await failsWith(const Reply(200, {'success': true}));
    });

    test('a refused permission is not a lapsed session and starts no refresh', () async {
      await signedInWith();
      final server = ScriptedServer((r) => Reply(403, errorBody('FORBIDDEN')));

      await expectLater(
        ApiClient.forTesting(adapter: server).get(_data),
        throwsA(isA<ApiFailure>().having((f) => f.kind, 'kind', FailureKind.forbidden)),
      );

      expect(server.to(ApiPaths.refresh), isEmpty);
      expect(AppSession.instance.isSignedIn, isTrue);
    });

    test('a failing call that has nothing to do with the session', () async {
      await signedInWith();
      final server = ScriptedServer((r) => Reply(500, errorBody('SERVER_ERROR')));

      await expectLater(
        ApiClient.forTesting(adapter: server).get(_data),
        throwsA(isA<ApiFailure>().having((f) => f.kind, 'kind', FailureKind.server)),
      );

      expect(server.to(ApiPaths.refresh), isEmpty);
      expect(AppSession.instance.isSignedIn, isTrue);
    });
  });

  group('sign-in and sign-out prove themselves another way', () {
    test('neither carries the old bearer token', () async {
      await signedInWith();
      final server = ScriptedServer((r) => const Reply(200, ok));
      final client = ApiClient.forTesting(adapter: server);

      await client.post(ApiPaths.signInSocial, body: const {'provider': 'GOOGLE'});
      await client.post(ApiPaths.signInLegacy, body: const {'legacyToken': 'x'});
      await client.post(ApiPaths.logout, body: const {'refreshToken': 'x'});
      await client.get(_data);

      expect(server.to(ApiPaths.signInSocial).single.bearer, isNull);
      expect(server.to(ApiPaths.signInLegacy).single.bearer, isNull);
      expect(server.to(ApiPaths.logout).single.bearer, isNull);
      expect(server.to(_data).single.bearer, isNotNull);
    });

    // The previous app's token is answered 403 UNAUTHENTICATED when the old
    // server does not know it. That is a verdict on that token, not "your session
    // lapsed": there is nothing to refresh, and a refresh would only spend the
    // session of whoever is signed in.
    for (final path in [ApiPaths.signInSocial, ApiPaths.signInLegacy]) {
      test('a refused sign-in is not answered with a refresh ($path)', () async {
        await signedInWith();
        final server = ScriptedServer((r) => Reply(403, errorBody('UNAUTHENTICATED')));

        await expectLater(
          ApiClient.forTesting(adapter: server).post(path, body: const {}),
          throwsA(isA<ApiFailure>()),
        );

        expect(server.to(ApiPaths.refresh), isEmpty);
        expect(AppSession.instance.isSignedIn, isTrue);
      });
    }
  });

  group('renewing before the token lapses', () {
    test('a token a day old is swapped', () async {
      await signedInWith(age: const Duration(days: 1, hours: 1));
      final fresh = jwt(issued: DateTime.now(), salt: 'fresh');
      final server = ScriptedServer((r) => Reply(200, renewed(access: fresh)));

      await ApiClient.forTesting(adapter: server).renewAccessTokenIfDue();

      expect(server.to(ApiPaths.refresh), hasLength(1));
      expect(AppSession.instance.accessToken, fresh);
    });

    test('a token a few hours old is left alone', () async {
      final tokens = await signedInWith(age: const Duration(hours: 5));
      final server = ScriptedServer((r) => Reply(200, renewed(access: 'x')));

      await ApiClient.forTesting(adapter: server).renewAccessTokenIfDue();

      expect(server.requests, isEmpty);
      expect(AppSession.instance.accessToken, tokens.accessToken);
    });

    test('nobody signed in, nothing to do', () async {
      FlutterSecureStorage.setMockInitialValues({});
      await LocalStore.instance.clear();
      await AppSession.instance.clear();
      final server = ScriptedServer((r) => const Reply(200, ok));

      await ApiClient.forTesting(adapter: server).renewAccessTokenIfDue();

      expect(server.requests, isEmpty);
    });

    test('a failed renewal leaves the person signed in and is not retried at once', () async {
      final tokens = await signedInWith(age: const Duration(days: 3));
      final server = ScriptedServer((r) => Reply.offline());
      final client = ApiClient.forTesting(adapter: server);

      await client.renewAccessTokenIfDue();
      await client.renewAccessTokenIfDue();
      await client.renewAccessTokenIfDue();

      expect(server.to(ApiPaths.refresh), hasLength(1), reason: 'waits ${AppConfig.renewRetryAfter.inMinutes} minutes');
      expect(AppSession.instance.isSignedIn, isTrue);
      expect(AppSession.instance.refreshToken, tokens.refreshToken);
    });

    test('a renewal the server refuses with 403 ends the session', () async {
      await signedInWith(age: const Duration(days: 3));
      final server = ScriptedServer((r) => Reply(403, errorBody('UNAUTHENTICATED')));

      await ApiClient.forTesting(adapter: server).renewAccessTokenIfDue();

      expect(AppSession.instance.status, SessionStatus.signedOut);
    });

    test('a token the phone\'s clock calls old is renewed once, not on every call', () async {
      // The server hands back a token whose `iat` is still two days ago, as if
      // the two clocks disagreed. Without the memory of the last renewal this
      // would refresh before every request.
      await signedInWith(age: const Duration(days: 3));
      final stale = jwt(issued: DateTime.now().subtract(const Duration(days: 2)), salt: 'stale');
      final server = ScriptedServer((r) {
        if (r.path == ApiPaths.refresh) return Reply(200, renewed(access: stale));
        return const Reply(200, ok);
      });
      final client = ApiClient.forTesting(adapter: server);

      await client.renewAccessTokenIfDue();
      await client.renewAccessTokenIfDue();
      await client.get(_data);
      await pumpEventQueue();

      expect(server.to(ApiPaths.refresh), hasLength(1));
    });

    test('an ordinary request starts the renewal without waiting for it', () async {
      final tokens = await signedInWith(age: const Duration(days: 2));
      final server = ScriptedServer((r) {
        if (r.path == ApiPaths.refresh) {
          return Reply(200, renewed(access: jwt(issued: DateTime.now(), salt: 'fresh')));
        }
        return const Reply(200, ok);
      });

      await ApiClient.forTesting(adapter: server).get(_data);
      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(server.to(_data).single.bearer, 'Bearer ${tokens.accessToken}',
          reason: 'the call went out with the token it had, which was still good');
      expect(server.to(ApiPaths.refresh), hasLength(1));
      expect(AppSession.instance.accessToken, isNot(tokens.accessToken));
    });
  });

  group('AuthTokens.accessDueForRenewal', () {
    final now = DateTime.now();
    const day = Duration(days: 1);

    AuthTokens withAccess(String access) => AuthTokens(
          accessToken: access,
          refreshToken: 'r' * 30,
          refreshExpiresAt: null,
        );

    test('not before a day, then yes', () {
      expect(withAccess(jwt(issued: now.subtract(const Duration(hours: 23)))).accessDueForRenewal(now, day), isFalse);
      expect(withAccess(jwt(issued: now.subtract(const Duration(hours: 25)))).accessDueForRenewal(now, day), isTrue);
    });

    test('a token that lives for an hour is renewed at half an hour', () {
      const hour = Duration(hours: 1);
      expect(withAccess(jwt(issued: now.subtract(const Duration(minutes: 20)), lifetime: hour)).accessDueForRenewal(now, day), isFalse);
      expect(withAccess(jwt(issued: now.subtract(const Duration(minutes: 31)), lifetime: hour)).accessDueForRenewal(now, day), isTrue);
    });

    test('something that is not a token is left to the 403 path', () {
      expect(withAccess('a' * 64).accessDueForRenewal(now, day), isFalse);
      expect(withAccess('a.b.c').accessDueForRenewal(now, day), isFalse);
      expect(withAccess('').accessDueForRenewal(now, day), isFalse);
    });
  });
}
