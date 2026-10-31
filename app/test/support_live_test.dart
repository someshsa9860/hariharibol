// The Help screens' live line. A staff reply or a status change that arrives over the socket reloads the reader's
// tickets and the conversation open on screen, and the line reports itself open only while a support screen
// watches it. The socket is replaced by a fake the test drives.

import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/support_config.dart';
import 'package:hariharibol/core/session/app_session.dart';
import 'package:hariharibol/models/auth_session.dart';
import 'package:hariharibol/models/paged.dart';
import 'package:hariharibol/models/support.dart';
import 'package:hariharibol/providers/support_live_provider.dart';
import 'package:hariharibol/providers/support_provider.dart';
import 'package:hariharibol/services/live_socket.dart';
import 'package:hariharibol/services/local_store.dart';
import 'package:hive_ce/hive.dart';

import 'fake_live_socket.dart';

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

Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory hiveDir;
  late List<FakeChannel> opened;
  late ProviderContainer container;
  var listLoads = 0;
  var ticketLoads = <String>[];

  setUpAll(() async {
    hiveDir = await Directory.systemTemp.createTemp('hariharibol_support_live_test');
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
    await signIn();
    opened = [];
    listLoads = 0;
    ticketLoads = [];
    container = ProviderContainer(overrides: [
      supportLiveSocketProvider.overrideWith((ref) {
        final socket = LiveSocket(connector: (uri) {
          final channel = FakeChannel(uri);
          opened.add(channel);
          return channel;
        });
        ref.onDispose(socket.dispose);
        return socket;
      }),
      supportTicketsProvider.overrideWith((_) {
        listLoads += 1;
        return Paged.empty<SupportTicket>();
      }),
      supportTicketProvider.overrideWith((_, id) {
        ticketLoads.add(id);
        return SupportTicket.fromJson({'id': id, 'category': 'bug', 'status': 'OPEN'});
      }),
    ]);
  });

  tearDown(() {
    container.dispose();
    supportLiveConnected.value = false;
  });

  group('the live line', () {
    test('is open while a support screen watches it, and shut when that stops', () async {
      expect(supportLiveConnected.value, isFalse);
      final watch = container.listen(supportLiveProvider, (_, _) {});
      await settle();
      expect(opened, hasLength(1));
      expect(supportLiveConnected.value, isTrue);

      watch.close();
      await settle();
      expect(supportLiveConnected.value, isFalse);
    });

    test('shows as shut when the server closes it', () async {
      container.listen(supportLiveProvider, (_, _) {});
      await settle();
      await opened.single.serverClose(1006);
      await settle();
      expect(supportLiveConnected.value, isFalse);
    });
  });

  group('a reply or a status change', () {
    test('a staff reply reloads the list and the conversation it belongs to', () async {
      container.listen(supportLiveProvider, (_, _) {});
      container.listen(supportTicketsProvider, (_, _) {});
      container.listen(supportTicketProvider('t1'), (_, _) {});
      await settle();
      expect(listLoads, 1);
      expect(ticketLoads, ['t1']);

      opened.single.push(SupportConfig.eventReply, {'ticketId': 't1', 'messageId': 'm9'});
      await settle();

      expect(listLoads, 2);
      expect(ticketLoads, ['t1', 't1']);
    });

    test('a status change reloads the list', () async {
      container.listen(supportLiveProvider, (_, _) {});
      container.listen(supportTicketsProvider, (_, _) {});
      await settle();

      opened.single.push(SupportConfig.eventUpdated, {'ticketId': 't1', 'status': 'RESOLVED'});
      await settle();
      expect(listLoads, 2);
    });

    test('a reply with no ticket id reloads only the list', () async {
      container.listen(supportLiveProvider, (_, _) {});
      container.listen(supportTicketsProvider, (_, _) {});
      await settle();

      opened.single.push(SupportConfig.eventReply, {'messageId': 'm9'});
      await settle();
      expect(listLoads, 2);
      expect(ticketLoads, isEmpty);
    });

    test('other events leave the tickets as they are', () async {
      container.listen(supportLiveProvider, (_, _) {});
      container.listen(supportTicketsProvider, (_, _) {});
      await settle();

      opened.single.push('chant.done', {'ticketId': 't1'});
      await settle();
      expect(listLoads, 1);
      expect(ticketLoads, isEmpty);
    });
  });
}
