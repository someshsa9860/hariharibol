import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/chat_config.dart';
import 'package:hariharibol/core/navigation/app_routes.dart';
import 'package:hariharibol/services/sakha_selection.dart';

const _channel = MethodChannel('hariharibol/selection');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  /// What the native side answers to [takeSelectedText]; the calls made are kept.
  late String? held;
  late List<String> calls;

  setUp(() {
    held = null;
    calls = [];
    messenger.setMockMethodCallHandler(_channel, (call) async {
      calls.add(call.method);
      return call.method == 'takeSelectedText' ? held : null;
    });
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(_channel, null);
    _channel.setMethodCallHandler(null);
    debugDefaultTargetPlatformOverride = null;
  });

  /// The native side says a new selection has arrived while the app was open.
  Future<void> selectionChanged() {
    final data = const StandardMethodCodec().encodeMethodCall(const MethodCall('selectionChanged'));
    return messenger.handlePlatformMessage(_channel.name, data, (_) {});
  }

  group('routeFor', () {
    test('nothing selected opens nothing', () {
      expect(SakhaSelection.routeFor(null), isNull);
      expect(SakhaSelection.routeFor(''), isNull);
      expect(SakhaSelection.routeFor('  \n '), isNull);
    });

    test('the selection goes into the chat route and comes back out unchanged', () {
      const text = 'What does "dharma-kṣetra" mean? Why 1+1 & 2 matter\nto Arjuna?';
      final route = SakhaSelection.routeFor(text);

      expect(route, isNotNull);
      expect(Uri.parse(route!).path, AppRoutes.chat);
      expect(Uri.parse(route).queryParameters[AppRoutes.chatDraftQuery], text);
    });

    test('outer spaces are not kept', () {
      final route = SakhaSelection.routeFor('  Hare Krishna  ');
      expect(Uri.parse(route!).queryParameters[AppRoutes.chatDraftQuery], 'Hare Krishna');
    });
  });

  group('clip', () {
    test('a short selection is only trimmed', () {
      expect(SakhaSelection.clip(' Om namo bhagavate '), 'Om namo bhagavate');
    });

    test('a long selection is cut to what the chat box takes', () {
      final long = 'a' * (ChatConfig.fallbackMaxInputChars + 50);
      expect(SakhaSelection.clip(long), hasLength(ChatConfig.fallbackMaxInputChars));
    });

    test('a cut never leaves half of an emoji at the end', () {
      // An emoji is two code units, so the cut falls between its halves.
      final text = '${'a' * (ChatConfig.fallbackMaxInputChars - 1)}🙏🙏';
      expect(SakhaSelection.clip(text), 'a' * (ChatConfig.fallbackMaxInputChars - 1));
    });
  });

  group('on Android', () {
    setUp(() => debugDefaultTargetPlatformOverride = TargetPlatform.android);

    test('a selection held when the app starts opens the chat with it in the box', () async {
      held = 'Hare Krishna Hare Krishna';
      final opened = <String>[];

      await SakhaSelection.test(opened.add).start();

      expect(calls, ['takeSelectedText']);
      expect(opened, [SakhaSelection.routeFor('Hare Krishna Hare Krishna')]);
    });

    test('starting with nothing held opens nothing', () async {
      final opened = <String>[];

      await SakhaSelection.test(opened.add).start();

      expect(opened, isEmpty);
    });

    test('a selection made while the app is open is taken when the native side says so', () async {
      final opened = <String>[];
      await SakhaSelection.test(opened.add).start();

      held = 'Gita 2.47';
      await selectionChanged();

      expect(opened, [SakhaSelection.routeFor('Gita 2.47')]);
    });

    test('a selection is taken once, not again on the next change', () async {
      held = 'Gita 2.47';
      final opened = <String>[];
      await SakhaSelection.test(opened.add).start();

      // The native side clears what it held once Dart has taken it.
      held = null;
      await selectionChanged();

      expect(opened, hasLength(1));
    });

    test('starting twice listens once', () async {
      final opened = <String>[];
      final selection = SakhaSelection.test(opened.add);

      await selection.start();
      await selection.start();

      expect(calls.where((call) => call == 'takeSelectedText'), hasLength(1));
    });
  });

  test('off Android nothing is asked for and nothing is opened', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    held = 'Gita 2.47';
    final opened = <String>[];

    await SakhaSelection.test(opened.add).start();

    expect(calls, isEmpty);
    expect(opened, isEmpty);
  });
}
