// Carrying someone from the previous app over: what is read from the phone, and what is done with the token
// afterwards. The network is a function handed in; the phone's storage is a fake store.

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/legacy_config.dart';
import 'package:hariharibol/core/constants/storage_keys.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/auth_session.dart';
import 'package:hariharibol/services/legacy_migration.dart';
import 'package:hariharibol/services/legacy_token_store.dart';

class _Tokens implements LegacyTokenStore {
  _Tokens(this.token);

  String? token;
  int cleared = 0;

  @override
  Future<String?> read() async => token;

  @override
  Future<void> clear() async {
    cleared += 1;
    token = null;
  }
}

AuthSession _session() => AuthSession.fromJson({
      'user': {'id': 'u1', 'email': 'a@b.c', 'name': 'A'},
      'tokens': {'accessToken': 'new-access', 'refreshToken': 'new-refresh'},
    });

void main() {
  group('the previous app\'s keys', () {
    test('are never the keys this app stores its own tokens under', () {
      final ours = {SecureKeys.accessToken, SecureKeys.refreshToken, SecureKeys.refreshExpiresAt};
      expect(LegacyConfig.secureTokenKeys.toSet().intersection(ours), isEmpty);
      expect(LegacyConfig.prefsTokenKeys.toSet().intersection(ours), isEmpty);
    });
  });

  group('cleanLegacyToken', () {
    test('takes a plain token as it is', () {
      expect(cleanLegacyToken('1|abcdefghijklmnop'), '1|abcdefghijklmnop');
    });

    test('takes off quotes, a Bearer prefix and whitespace', () {
      expect(cleanLegacyToken('  "abcdefghijklmnop"  '), 'abcdefghijklmnop');
      expect(cleanLegacyToken('Bearer abcdefghijklmnop'), 'abcdefghijklmnop');
      expect(cleanLegacyToken('bearer   abcdefghijklmnop '), 'abcdefghijklmnop');
    });

    test('is null for anything that is not a usable token', () {
      expect(cleanLegacyToken(null), isNull);
      expect(cleanLegacyToken(42), isNull);
      expect(cleanLegacyToken(''), isNull);
      expect(cleanLegacyToken('   '), isNull);
      expect(cleanLegacyToken('short'), isNull);
      expect(cleanLegacyToken('""'), isNull);
    });
  });

  group('LegacyMigration.attempt', () {
    test('does nothing, and makes no call, when the previous app left no token', () async {
      var calls = 0;
      final migration = LegacyMigration(tokens: _Tokens(null), signIn: (_) async {
        calls += 1;
        return _session();
      });

      expect(await migration.attempt(), isFalse);
      expect(calls, 0);
    });

    test('signs in with the token and then deletes it', () async {
      final tokens = _Tokens('legacy-token-1234');
      String? sent;
      final migration = LegacyMigration(tokens: tokens, signIn: (t) async {
        sent = t;
        return _session();
      });

      expect(await migration.attempt(), isTrue);
      expect(sent, 'legacy-token-1234');
      expect(tokens.cleared, 1);
    });

    test('tries only once a launch', () async {
      var calls = 0;
      final migration = LegacyMigration(tokens: _Tokens('legacy-token-1234'), signIn: (_) async {
        calls += 1;
        throw const ApiFailure(kind: FailureKind.network);
      });

      await migration.attempt();
      await migration.attempt();
      expect(calls, 1);
    });

    test('keeps the token when the failure may pass: no signal, the server down, a timeout', () async {
      for (final failure in [
        const ApiFailure(kind: FailureKind.network),
        const ApiFailure(kind: FailureKind.timeout),
        const ApiFailure(kind: FailureKind.server, statusCode: 502, code: 'LEGACY_UNAVAILABLE'),
        const ApiFailure(kind: FailureKind.forbidden, statusCode: 403, code: 'FORBIDDEN'),
        const ApiFailure(kind: FailureKind.notFound, statusCode: 404),
      ]) {
        final tokens = _Tokens('legacy-token-1234');
        final migration = LegacyMigration(tokens: tokens, signIn: (_) async => throw failure);

        expect(await migration.attempt(), isFalse, reason: '$failure');
        expect(tokens.cleared, 0, reason: '$failure');
        expect(tokens.token, isNotNull, reason: '$failure');
      }
    });

    test('deletes a token the previous server does not recognise: it will never work', () async {
      final tokens = _Tokens('legacy-token-1234');
      final migration = LegacyMigration(
        tokens: tokens,
        signIn: (_) async => throw const ApiFailure(kind: FailureKind.unauthorized, statusCode: 403, code: 'UNAUTHENTICATED'),
      );

      expect(await migration.attempt(), isFalse);
      expect(tokens.cleared, 1);
    });

    test('a surprise is not a crash', () async {
      final migration = LegacyMigration(tokens: _Tokens('legacy-token-1234'), signIn: (_) async => throw StateError('boom'));
      expect(await migration.attempt(), isFalse);
    });
  });
}
