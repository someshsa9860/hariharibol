// Text selected in another app and sent to Ask Sakha opens the chat with it in
// the box. It is not sent: the reader adds a question if they want one, and
// sends it themselves, so nothing is charged until they do.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/navigation/app_navigator.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/providers/chat_provider.dart';
import 'package:hariharibol/providers/language_chain_provider.dart';
import 'package:hariharibol/views/chat/chat_view.dart';

import 'support/fake_chat_device.dart';
import 'support/fake_chat_service.dart';

void main() {
  late FakeChatService fake;

  Future<void> open(WidgetTester tester, String? draft) async {
    tester.view.physicalSize = const Size(400 * 3, 800 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        chatServiceProvider.overrideWithValue(fake),
        chatImagePickerProvider.overrideWithValue(FakeChatImagePicker()),
        speechInputProvider.overrideWithValue(FakeSpeechInput()),
        readingChainProvider.overrideWithValue(const ['en']),
      ],
      child: MaterialApp(
        navigatorKey: AppNavigator.instance.rootKey,
        scaffoldMessengerKey: AppNavigator.instance.messengerKey,
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: ChatView(draft: draft),
      ),
    ));
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
  }

  setUp(() => fake = FakeChatService());

  tearDown(() {
    AppNavigator.instance.messengerKey.currentState?.clearSnackBars();
  });

  testWidgets('the selected text is in the box, and nothing is sent', (tester) async {
    const text = 'Gita 2.47: what does "nishkama" mean?';
    await open(tester, text);

    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, text);
    expect(fake.calls.where((call) => call == 'create' || call.startsWith('send')), isEmpty);
  });

  testWidgets('a draft that is only spaces leaves the box empty', (tester) async {
    await open(tester, '   ');

    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);
    expect(fake.calls, isEmpty);
  });

  testWidgets('no draft leaves the box empty', (tester) async {
    await open(tester, null);

    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);
  });
}
