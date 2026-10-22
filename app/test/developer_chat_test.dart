// The reader's chat with the developer: the messages as the API sends them, the live line (a fake websocket the
// test drives), and the conversation that sits on both — a message shown at once and confirmed behind it, the
// developer's reply arriving over the socket, a failed send that can be tried again.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/developer_chat_config.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/auth_session.dart';
import 'package:hariharibol/models/developer_chat.dart';
import 'package:hariharibol/providers/developer_chat_provider.dart';
import 'package:hariharibol/services/developer_chat_service.dart';
import 'package:hariharibol/services/live_socket.dart';
import 'package:hariharibol/services/push_link.dart';
import 'package:hariharibol/core/session/app_session.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hive_ce/hive.dart';

import 'fake_live_socket.dart';

class FakeDeveloperChat implements DeveloperChatService {
  List<DeveloperMessage> stored = [];
  bool failSends = false;
  int sent = 0;
  int markedRead = 0;
  Completer<void>? gate;

  @override
  Future<DeveloperThread> thread({String? before}) async => DeveloperThread(messages: stored);

  @override
  Future<DeveloperMessage> send(String body) async {
    await gate?.future;
    if (failSends) throw const ApiFailure(kind: FailureKind.network);
    sent += 1;
    return DeveloperMessage(id: 'srv-$sent', fromDeveloper: false, body: body, createdAt: DateTime.now());
  }

  @override
  Future<int> unread() async => 0;

  @override
  Future<void> markRead() async => markedRead += 1;
}

Map<String, dynamic> wire(String id, String body, {bool fromDeveloper = false}) => {
      'id': id,
      'conversationId': 'c1',
      'fromDeveloper': fromDeveloper,
      'body': body,
      'createdAt': '2026-10-22T02:46:11.000Z',
    };

Future<void> signIn() async {
  FlutterSecureStorage.setMockInitialValues({});
  await LocalStore.instance.clear();
  await AppSession.instance.start(
    AuthSession.fromJson({
      'user': {'id': 'u1', 'email': 'reader@example.com'},
      'tokens': {'accessToken': 'token-1', 'refreshToken': 'refresh-1'},
    }),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory hiveDir;

  setUpAll(() async {
    hiveDir = await Directory.systemTemp.createTemp('hariharibol_developer_chat_test');
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

  group('the messages', () {
    test('are read from the API, developer or reader', () {
      final thread = DeveloperThread.fromJson({
        'messages': [wire('m1', 'Hello'), wire('m2', 'Hi there', fromDeveloper: true)],
        'hasMore': true,
      });
      expect(thread.messages.map((m) => m.fromDeveloper), [false, true]);
      expect(thread.hasMore, isTrue);
    });
  });

  group('the developer deep link', () {
    test('opens the chat', () {
      expect(deeplinkRoute('hariharibol://developer'), '/developer');
    });
  });

  group('the live line', () {
    late List<FakeChannel> opened;
    late LiveSocket socket;

    setUp(() async {
      await signIn();
      opened = [];
      socket = LiveSocket(connector: (uri) {
        final channel = FakeChannel(uri);
        opened.add(channel);
        return channel;
      });
    });

    tearDown(() => socket.dispose());

    test('opens with the token and passes events on', () async {
      final events = <LiveEvent>[];
      socket.events.listen(events.add);
      socket.start();
      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(opened.single.uri.queryParameters, {'token': 'token-1'});
      opened.single.push(DeveloperChatConfig.messageEvent, wire('m1', 'Fixed'));
      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(events.single.event, DeveloperChatConfig.messageEvent);
      expect(events.single.payload['body'], 'Fixed');
    });

    test('comes back after the line drops, and not after stop', () async {
      socket.start();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      await opened.single.serverClose(1006);
      await Future<void>.delayed(DeveloperChatConfig.reconnectMin + const Duration(milliseconds: 200));
      expect(opened, hasLength(2));

      socket.stop();
      await opened.last.serverClose(1006);
      await Future<void>.delayed(DeveloperChatConfig.reconnectMin + const Duration(milliseconds: 200));
      expect(opened, hasLength(2));
    });
  });

  group('the conversation', () {
    late FakeDeveloperChat fake;
    late ProviderContainer container;
    late List<FakeChannel> opened;

    setUp(() async {
      await signIn();
      fake = FakeDeveloperChat();
      opened = [];
      container = ProviderContainer(overrides: [
        developerChatServiceProvider.overrideWithValue(fake),
        developerChatSocketProvider.overrideWith((ref) {
          final socket = LiveSocket(connector: (uri) {
            final channel = FakeChannel(uri);
            opened.add(channel);
            return channel;
          });
          ref.onDispose(socket.dispose);
          return socket;
        }),
      ]);
      addTearDown(container.dispose);
    });

    Future<DeveloperChatNotifier> open() async {
      container.listen(developerChatProvider, (_, _) {});
      await container.read(developerChatProvider.future);
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return container.read(developerChatProvider.notifier);
    }

    List<DeveloperMessage> messages() => container.read(developerChatProvider).requireValue.messages;

    test('shows what was said before, oldest first', () async {
      fake.stored = [
        DeveloperMessage.fromJson(wire('m1', 'Hello')),
        DeveloperMessage.fromJson(wire('m2', 'Hi!', fromDeveloper: true)),
      ];
      await open();
      expect(messages().map((m) => m.body), ['Hello', 'Hi!']);
    });

    test('a message is shown at once and replaced by the saved one', () async {
      final notifier = await open();
      fake.gate = Completer<void>();

      final sending = notifier.send('The counter froze');
      await Future<void>.delayed(Duration.zero);
      expect(messages().single.pending, isTrue);

      fake.gate!.complete();
      await sending;
      expect(messages().single.id, 'srv-1');
      expect(messages().single.pending, isFalse);
    });

    test('a failed send is marked and can be tried again', () async {
      final notifier = await open();
      fake.failSends = true;
      await notifier.send('Hello?');
      expect(messages().single.failed, isTrue);

      fake.failSends = false;
      await notifier.retry(messages().single.id);
      expect(messages().single.failed, isFalse);
      expect(messages().single.id, 'srv-1');
    });

    test('the developer’s reply arrives over the socket, once, and is marked read', () async {
      await open();
      expect(opened, hasLength(1));

      opened.single
        ..push(DeveloperChatConfig.messageEvent, wire('d1', 'Fixed in the next update', fromDeveloper: true))
        ..push(DeveloperChatConfig.messageEvent, wire('d1', 'Fixed in the next update', fromDeveloper: true));
      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(messages().map((m) => m.body), ['Fixed in the next update']);
      expect(fake.markedRead, 1);
    });

    test('the reader’s own message echoed by the socket does not appear twice', () async {
      final notifier = await open();
      fake.gate = Completer<void>();
      final sending = notifier.send('Hello');
      await Future<void>.delayed(Duration.zero);

      // The server publishes the saved message before the HTTP answer reaches the phone.
      opened.single.push(DeveloperChatConfig.messageEvent, wire('srv-1', 'Hello'));
      await Future<void>.delayed(const Duration(milliseconds: 20));
      fake.gate!.complete();
      await sending;

      expect(messages(), hasLength(1));
      expect(messages().single.id, 'srv-1');
      expect(jsonEncode(messages().single.pending), 'false');
    });
  });
}
