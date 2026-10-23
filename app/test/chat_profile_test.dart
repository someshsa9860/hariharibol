// What Sakha has noticed about the reader: the shape the server sends, the sheet
// that shows it, and the two ways it stays theirs — switch the noticing off, or
// delete what is saved.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/navigation/app_navigator.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/app_user.dart';
import 'package:hariharibol/models/sakha_profile.dart';
import 'package:hariharibol/providers/chat_provider.dart';
import 'package:hariharibol/providers/sakha_profile_provider.dart';
import 'package:hariharibol/providers/session_provider.dart';
import 'package:hariharibol/widgets/chat/chat_profile_details.dart';
import 'package:hariharibol/widgets/chat/chat_profile_sheet.dart';

import 'support/fake_chat_service.dart';

const _noted = SakhaProfile(
  fields: {
    SakhaTrait.gender: 'male',
    SakhaTrait.age: 'in his fifties',
    SakhaTrait.behaviour: 'thoughtful and patient',
    SakhaTrait.lifeStage: 'a retired teacher',
    SakhaTrait.spiritualStage: 'a sincere beginner',
    SakhaTrait.communication: 'short, plain answers',
  },
  notes: ['Chants sixteen rounds a day'],
  keywords: ['dharma', 'anger', 'gita'],
);

const _offline = 'No connection. Check your internet and try again.';
const _deleteLabel = 'Delete what Sakha has noted';
const _emptyLine = 'Nothing noted yet. As you chat, Sakha will note things like how you like to be answered.';

final _asha = AppUser.fromJson({'id': 'usr_1', 'email': 'asha42@smoke.test', 'name': 'Asha Devi'});
final _ravi = AppUser.fromJson({'id': 'usr_2', 'email': 'ravi7@smoke.test', 'name': 'Ravi Das'});

void main() {
  late FakeChatService fake;

  setUp(() => fake = FakeChatService());

  /// Opens the sheet from a button, on a window tall enough to see all of it.
  Future<void> openSheet(
    WidgetTester tester, {
    Size window = const Size(600, 1600),
    double textScale = 1,
    Locale locale = const Locale('en'),
  }) async {
    tester.view.physicalSize = window;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        chatServiceProvider.overrideWithValue(fake),
        currentUserProvider.overrideWith(() => _FixedUser(_asha)),
      ],
      child: MaterialApp(
        navigatorKey: AppNavigator.instance.rootKey,
        scaffoldMessengerKey: AppNavigator.instance.messengerKey,
        theme: AppTheme.light,
        locale: locale,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(onPressed: () => showChatProfileSheet(context), child: const Text('open')),
            ),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
  }

  Future<void> afterTap(WidgetTester tester) async {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  bool learning(WidgetTester tester) => tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value;

  group('the profile', () {
    test('is read as the server sends it, and is empty when the server sends nothing', () {
      final nothing = SakhaProfile.fromJson(const {});
      expect(nothing.learning, isTrue);
      expect(nothing.isEmpty, isTrue);
      expect(nothing.updatedAt, isNull);

      final profile = SakhaProfile.fromJson({
        'learning': false,
        'traits': {
          // Not in the order the app lists them, and one empty: an empty value is no value.
          'communication': 'short and warm',
          'age': 'in their thirties',
          'gender': '',
          'notes': ['Chants every morning', 'Asks about the Gita'],
        },
        'keywords': ['dharma', 'anger'],
        'updatedAt': '2026-10-22T04:30:00.000Z',
      });

      expect(profile.learning, isFalse);
      expect(profile.isEmpty, isFalse);
      expect(profile.fields.keys, [SakhaTrait.age, SakhaTrait.communication]);
      expect(profile.fields[SakhaTrait.age], 'in their thirties');
      expect(profile.notes, ['Chants every morning', 'Asks about the Gita']);
      expect(profile.keywords, ['dharma', 'anger']);
      expect(profile.updatedAt?.toUtc(), DateTime.utc(2026, 10, 22, 4, 30));

      // Switching the noticing back on changes that and nothing else.
      final on = profile.copyWith(learning: true);
      expect(on.learning, isTrue);
      expect(on.fields, profile.fields);
      expect(on.notes, profile.notes);
      expect(on.keywords, profile.keywords);
    });

    test('is read again when a different account signs in, never kept for the next one', () async {
      final container = ProviderContainer(overrides: [
        chatServiceProvider.overrideWithValue(fake),
        currentUserProvider.overrideWith(() => _SwitchableUser(_asha)),
      ]);
      addTearDown(container.dispose);
      fake.profileValue = _noted;
      container.listen(sakhaProfileProvider, (_, _) {});
      final reader = container.read(currentUserProvider.notifier) as _SwitchableUser;

      expect((await container.read(sakhaProfileProvider.future)).fields, isNotEmpty);

      fake.profileValue = const SakhaProfile();
      reader.become(_ravi);
      expect((await container.read(sakhaProfileProvider.future)).isEmpty, isTrue);
      expect(fake.calls.where((call) => call == 'profile'), hasLength(2));
    });
  });

  group('the sheet', () {
    testWidgets('shows what Sakha has noticed, and says the keywords are for the reader alone', (tester) async {
      fake.profileValue = _noted;
      await openSheet(tester);

      for (final line in [
        'What Sakha has noticed',
        'Keep learning about me',
        'Gender', 'male',
        'Age', 'in his fifties',
        'How you come across', 'thoughtful and patient',
        'Life stage', 'a retired teacher',
        'On the path', 'a sincere beginner',
        'How you like to be answered', 'short, plain answers',
        // Headings are set in capitals.
        'ALSO REMEMBERED', 'Chants sixteen rounds a day',
        'WHAT YOUR CHATS WERE ABOUT',
        'Only you see these words. Sakha never reads them when it writes a reply.',
        'If you say what you are struggling with today, Sakha is told for that day only. It is not kept here.',
        _deleteLabel,
      ]) {
        expect(find.text(line), findsOneWidget, reason: line);
      }
      for (final keyword in _noted.keywords) {
        expect(find.widgetWithText(Chip, keyword), findsOneWidget, reason: keyword);
      }
      expect(learning(tester), isTrue);
    });

    testWidgets('with nothing noted there is nothing to delete', (tester) async {
      await openSheet(tester);

      expect(find.text(_emptyLine), findsOneWidget);
      expect(find.text(_deleteLabel), findsNothing);
      expect(find.byType(SwitchListTile), findsOneWidget);
    });

    testWidgets('the switch turns the noticing off; a refusal puts it back and says why', (tester) async {
      await openSheet(tester);
      expect(learning(tester), isTrue);

      fake.learningFailure = const ApiFailure(kind: FailureKind.network);
      await tester.tap(find.byType(SwitchListTile));
      await afterTap(tester);

      expect(learning(tester), isTrue);
      expect(find.text(_offline), findsOneWidget);

      await tester.tap(find.byType(SwitchListTile));
      await afterTap(tester);

      expect(learning(tester), isFalse);
      expect(find.text(_offline), findsNothing);
      expect(fake.calls, ['profile', 'learning:false', 'learning:false']);
    });

    testWidgets('deleting asks first: Cancel keeps everything, Delete empties it', (tester) async {
      fake.profileValue = _noted;
      await openSheet(tester);
      final dialog = find.byType(AlertDialog);

      await tester.tap(find.text(_deleteLabel));
      await afterTap(tester);
      expect(
        find.descendant(of: dialog, matching: find.text('This removes everything saved on this page. Your chat is not cleared.')),
        findsOneWidget,
      );

      await tester.tap(find.descendant(of: dialog, matching: find.text('Cancel')));
      await afterTap(tester);
      expect(fake.calls, isNot(contains('deleteProfile')));
      expect(find.text('thoughtful and patient'), findsOneWidget);

      await tester.tap(find.text(_deleteLabel));
      await afterTap(tester);
      await tester.tap(find.descendant(of: dialog, matching: find.text('Delete')));
      await afterTap(tester);

      expect(fake.calls, contains('deleteProfile'));
      expect(find.text(_emptyLine), findsOneWidget);
      expect(find.text(_deleteLabel), findsNothing);
      // The reader's choice to be noticed or not is theirs and stays as it was.
      expect(learning(tester), isTrue);
    });

    testWidgets('a profile that cannot be read says so, and Try again reads it', (tester) async {
      fake.profileFailure = const ApiFailure(kind: FailureKind.network);
      await openSheet(tester);

      expect(find.text(_offline), findsOneWidget);
      expect(find.byType(SwitchListTile), findsNothing);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Try again'));
      await afterTap(tester);

      expect(find.byType(SwitchListTile), findsOneWidget);
      expect(fake.calls.where((call) => call == 'profile'), hasLength(2));
    });

    testWidgets('every language fits a small phone at the largest text size', (tester) async {
      fake.profileValue = _noted;

      for (final locale in AppLocalizations.supportedLocales) {
        await openSheet(tester, window: const Size(320, 568), textScale: 2, locale: locale);

        expect(find.byType(ChatProfileDetails), findsOneWidget, reason: '${locale.languageCode} shows the profile');
        expect(tester.takeException(), isNull, reason: '${locale.languageCode} fits');
        // Out of the tree, so the next language opens a sheet of its own.
        await tester.pumpWidget(const SizedBox());
      }
    });
  });
}

/// A signed-in reader, so the provider has an account to key the profile by
/// without the session singleton.
class _FixedUser extends CurrentUser {
  _FixedUser(this._user);

  final AppUser? _user;

  @override
  AppUser? build() => _user;
}

/// A reader who can change, as when one account signs out and another signs in.
class _SwitchableUser extends CurrentUser {
  _SwitchableUser(this._first);

  final AppUser? _first;

  @override
  AppUser? build() => _first;

  void become(AppUser? user) => state = user;
}
