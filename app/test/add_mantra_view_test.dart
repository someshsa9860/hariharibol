import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/navigation/app_navigator.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/own_mantra.dart';
import 'package:hariharibol/providers/chat_provider.dart';
import 'package:hariharibol/providers/own_mantra_provider.dart';
import 'package:hariharibol/views/mantra/add_mantra_view.dart';

import 'support/chant_stores.dart';
import 'support/fake_chat_device.dart';
import 'support/fake_own_mantra_service.dart';

void main() {
  final text = lookupAppLocalizations(const Locale('en'));

  late FakeOwnMantraService fake;
  late FakeSpeechInput speech;

  setUp(() {
    keepStoresInMemory();
    fake = FakeOwnMantraService()
      ..found = MantraSuggestions(suggestionId: 'sg-1', items: [
        suggestion(0),
        suggestion(1, status: 'shared'),
        suggestion(2, kind: 'saint'),
        suggestion(3, status: 'yours', slug: 'held'),
      ]);
    speech = FakeSpeechInput();
  });

  tearDown(() => AppNavigator.instance.messengerKey.currentState?.clearSnackBars());

  Future<void> open(WidgetTester tester) async {
    tester.view.physicalSize = const Size(400 * 3, 800 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ownMantraServiceProvider.overrideWithValue(fake),
          chatImagePickerProvider.overrideWithValue(FakeChatImagePicker()),
          speechInputProvider.overrideWithValue(speech),
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
          home: const AddMantraView(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
  }

  Finder button(String label) =>
      find.ancestor(of: find.text(label), matching: find.bySubtype<FilledButton>());

  bool enabled(WidgetTester tester, String label) =>
      tester.widget<FilledButton>(button(label)).onPressed != null;

  Future<void> type(WidgetTester tester, String words) async {
    await tester.enterText(find.byType(TextField), words);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
  }

  Future<void> tapButton(WidgetTester tester, String label) async {
    await tester.ensureVisible(button(label));
    await tester.pump();
    await tester.tap(button(label));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
  }

  /// The list is lazy, so a row below the fold is not built until it is scrolled to.
  Future<void> reveal(WidgetTester tester, String label) => tester.scrollUntilVisible(
        find.text(label),
        200,
        scrollable: find.descendant(of: find.byType(AddMantraView), matching: find.byType(Scrollable)).first,
      );

  Future<void> tick(WidgetTester tester, int tile) async {
    final box = find.byType(CheckboxListTile).at(tile);
    await tester.ensureVisible(box);
    await tester.pump();
    await tester.tap(box);
    await tester.pump(const Duration(milliseconds: 300));
  }

  testWidgets('says what it is for, and cannot search for nothing', (tester) async {
    await open(tester);

    expect(find.text(text.ownMantraAddTitle), findsOneWidget);
    expect(find.text(text.ownMantraAddBody), findsOneWidget);
    expect(find.text(text.ownMantraWellKnownNote), findsOneWidget);
    expect(enabled(tester, text.ownMantraFind), isFalse);

    await type(tester, '   ');
    expect(enabled(tester, text.ownMantraFind), isFalse, reason: 'spaces are nothing');

    await type(tester, 'hanuman');
    expect(enabled(tester, text.ownMantraFind), isTrue);
  });

  testWidgets('what is typed is searched as typed, and the finds are listed', (tester) async {
    await open(tester);

    await type(tester, 'hanuman chalisa');
    await tapButton(tester, text.ownMantraFind);

    expect(fake.searched, ['hanuman chalisa']);
    expect(find.text('Mantra 0'), findsOneWidget);
    expect(find.text('Mantra 1'), findsOneWidget);
    expect(find.text(text.ownMantraChosenCount(0, 5)), findsOneWidget);
    expect(find.text(text.ownMantraStatusShared), findsOneWidget);
    await reveal(tester, text.ownMantraStatusYours);
    expect(find.text(text.ownMantraStatusYours), findsOneWidget);
    expect(enabled(tester, text.ownMantraAddChosen), isFalse, reason: 'nothing chosen yet');
  });

  testWidgets('a mantra the reader already holds cannot be ticked, only opened', (tester) async {
    await open(tester);
    await type(tester, 'om');
    await tapButton(tester, text.ownMantraFind);

    // Three can be ticked; the fourth is a plain row with a way to open it.
    await reveal(tester, text.ownMantraStatusYours);
    expect(find.byType(CheckboxListTile), findsNWidgets(3));
    expect(find.byTooltip(text.ownMantraOpen), findsOneWidget);
  });

  testWidgets('ticking counts the choices and opens the way to add them', (tester) async {
    await open(tester);
    await type(tester, 'om');
    await tapButton(tester, text.ownMantraFind);

    await tick(tester, 0);
    expect(find.text(text.ownMantraChosenCount(1, 5)), findsOneWidget);
    expect(enabled(tester, text.ownMantraAddChosen), isTrue);

    await tick(tester, 2);
    expect(find.text(text.ownMantraChosenCount(2, 5)), findsOneWidget);

    await tick(tester, 0);
    await tick(tester, 2);
    expect(find.text(text.ownMantraChosenCount(0, 5)), findsOneWidget);
    expect(enabled(tester, text.ownMantraAddChosen), isFalse);
  });

  testWidgets('adding shows what became of each and ends with Done', (tester) async {
    fake.made = [
      OwnMantraResult(index: 0, status: 'created', mantra: ownMantra('a')),
      OwnMantraResult(index: 1, status: 'shared', mantra: ownMantra('b', mine: false)),
    ];
    await open(tester);
    await type(tester, 'om');
    await tapButton(tester, text.ownMantraFind);
    await tick(tester, 0);
    await tick(tester, 1);

    await tapButton(tester, text.ownMantraAddChosen);

    expect(fake.createdFor, ['sg-1']);
    expect(fake.created.single, [0, 1]);
    expect(find.text('Name of a'), findsOneWidget);
    expect(find.text('Name of b'), findsOneWidget);
    expect(find.text(text.ownMantraResultCreated), findsOneWidget);
    expect(find.text(text.ownMantraResultShared), findsOneWidget);
    expect(find.text(text.ownMantraChangePicture), findsOneWidget, reason: 'only for the one the reader made');
    expect(button(text.actionDone), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('a search that finds nothing says so, in words, with no list', (tester) async {
    fake.found = const MantraSuggestions(suggestionId: '', items: []);
    await open(tester);

    await type(tester, 'zzz');
    await tapButton(tester, text.ownMantraFind);

    expect(find.text(text.ownMantraNoneFound), findsOneWidget);
    expect(find.byType(CheckboxListTile), findsNothing);
  });

  testWidgets('a refused search is explained in the reader\'s language, not the server\'s', (tester) async {
    fake.searchFailure = const ApiFailure(
      kind: FailureKind.validation,
      code: 'MANTRA_INPUT_NOT_USABLE',
      message: 'SELECT secret FROM server',
    );
    await open(tester);

    await type(tester, '???');
    await tapButton(tester, text.ownMantraFind);

    expect(find.text(text.ownMantraErrorNotUsable), findsOneWidget);
    expect(find.textContaining('SELECT'), findsNothing);
    expect(enabled(tester, text.ownMantraFind), isTrue, reason: 'the words are kept to try again');
  });

  testWidgets('a failure while adding keeps the choices and says why', (tester) async {
    fake.createFailure = const ApiFailure(kind: FailureKind.server, code: 'MANTRA_AI_UNAVAILABLE');
    await open(tester);
    await type(tester, 'om');
    await tapButton(tester, text.ownMantraFind);
    await tick(tester, 0);

    await tapButton(tester, text.ownMantraAddChosen);

    expect(find.text(text.ownMantraErrorUnavailable), findsOneWidget);
    expect(find.text(text.ownMantraChosenCount(1, 5)), findsOneWidget);
    expect(enabled(tester, text.ownMantraAddChosen), isTrue);
  });

  testWidgets('saying a mantra puts the words in the box and searches nothing by itself', (tester) async {
    await open(tester);

    await tester.tap(find.byTooltip(text.ownMantraMic));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(speech.started, hasLength(1));
    expect(find.byTooltip(text.chatMicStop), findsOneWidget);

    speech.hear('om namo narayanaya');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      contains('om namo narayanaya'),
    );
    expect(fake.searched, isEmpty, reason: 'the reader reads it first and presses Find');
  });
}
