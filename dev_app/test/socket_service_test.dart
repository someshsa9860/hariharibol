import 'dart:convert';
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol_dev/core/session/app_session.dart';
import 'package:hariharibol_dev/models/auth_session.dart';
import 'package:hariharibol_dev/models/dev_user.dart';
import 'package:hariharibol_dev/core/constants/app_config.dart';
import 'package:hariharibol_dev/services/socket_service.dart';

import 'fake_socket.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late List<FakeChannel> opened;
  late SocketService socket;

  setUp(() async {
    // A session in memory, without touching secure storage.
    AppSession.instance.debugSignIn(
      AuthSession(
        user: const DevUser(id: 'u1', email: 'owner@example.com', name: 'Owner'),
        tokens: const AuthTokens(accessToken: 'token-1', refreshToken: 'refresh-1', refreshExpiresAt: null),
      ),
    );
    opened = [];
    socket = SocketService(
      connector: (uri) {
        final channel = FakeChannel(uri);
        opened.add(channel);
        return channel;
      },
      random: Random(1),
    );
  });

  tearDown(() => socket.stop());

  Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));

  test('connects to /ws with the token and the dev flag, and is live once the server says connected', () async {
    final statuses = <SocketStatus>[];
    socket.statuses.listen(statuses.add);
    socket.start();
    await settle();

    expect(opened, hasLength(1));
    expect(opened.single.uri.queryParameters, {'token': 'token-1', 'app': 'dev'});

    opened.single.push('connected', {'userId': 'u1'});
    await settle();
    expect(socket.status, SocketStatus.connected);
    expect(statuses, [SocketStatus.connecting, SocketStatus.connected]);
  });

  test('hands events to listeners and answers pong silently', () async {
    final received = <SocketMessage>[];
    socket.messages.listen(received.add);
    socket.start();
    await settle();

    opened.single
      ..push('connected')
      ..push('pong')
      ..push('dev.event', {'id': 'e1', 'title': 'Boom'});
    await settle();

    expect(received.map((m) => m.event), ['connected', 'dev.event']);
    expect(received.last.payload['title'], 'Boom');
  });

  test('says whether the app is on screen in its heartbeat', () async {
    socket.start();
    await settle();
    opened.single.push('connected');
    await settle();

    // The first heartbeat went out as soon as the line was live.
    expect(jsonDecode(opened.single.sent.last as String), {'type': 'ping', 'foreground': true});

    socket.setForeground(false);
    expect(jsonDecode(opened.single.sent.last as String), {'type': 'ping', 'foreground': false});
  });

  test('comes back after the line drops', () async {
    socket.start();
    await settle();
    opened.single.push('connected');
    await settle();

    await opened.single.serverClose(1006);
    await settle();
    expect(socket.status, SocketStatus.offline);

    // Backing off: nothing yet, then it tries again.
    expect(opened, hasLength(1));
    await Future<void>.delayed(SocketConfig.reconnectMin + const Duration(seconds: 1, milliseconds: 100));
    expect(opened, hasLength(2));
  });

  test('an account without developer access is not retried', () async {
    socket.start();
    await settle();
    await opened.single.serverClose(4003);
    await settle();

    expect(socket.status, SocketStatus.forbidden);
    await Future<void>.delayed(SocketConfig.reconnectMin + const Duration(seconds: 1, milliseconds: 100));
    expect(opened, hasLength(1));
  });

  test('stop closes the line and stays closed', () async {
    socket.start();
    await settle();
    socket.stop();

    expect(opened.single.closedByApp, isTrue);
    expect(socket.status, SocketStatus.idle);
  });
}
