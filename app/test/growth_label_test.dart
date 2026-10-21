// The "Where would you like to grow today?" card names each struggle by the
// strength it builds. The server still sends the weakness ("Anger"), so the app
// does the renaming — by slug — and these are the places it must hold: the
// chips, the reason under a verse, and an issue the app has never heard of.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/l10n/generated/app_localizations_en.dart';
import 'package:hariharibol/l10n/generated/app_localizations_hi.dart';
import 'package:hariharibol/models/home_feed.dart';
import 'package:hariharibol/models/issue.dart';
import 'package:hariharibol/models/sloka.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/providers/home_provider.dart';
import 'package:hariharibol/providers/issues_provider.dart';
import 'package:hariharibol/widgets/dashboard/growth_label.dart';
import 'package:hariharibol/widgets/dashboard/mood_chips.dart';

class _FakeFeed extends HomeFeedNotifier {
  _FakeFeed(this.reportedToday);

  final List<String> reportedToday;

  @override
  Future<HomeFeed> build() async =>
      HomeFeed(date: '2026-10-20', issuesReportedToday: reportedToday);
}

Issue issue(String slug, String name, {String category = 'VIKARA'}) =>
    Issue(id: slug, slug: slug, name: name, category: category);

PersonalSloka personal({String? reason, SlokaIssue? issue}) => PersonalSloka(
      id: 's1',
      reason: reason,
      issue: issue,
      verse: const Verse(
        id: 'v1',
        verseId: '1.2.47',
        bookNumber: 1,
        type: 'SHLOKA',
        chapterNumber: 2,
        verseNumber: 47,
      ),
    );

Future<void> pumpMoodCard(
  WidgetTester tester, {
  required List<Issue> issues,
  List<String> reportedToday = const [],
}) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [
        issuesProvider.overrideWith((ref) async => issues),
        homeFeedProvider.overrideWith(() => _FakeFeed(reportedToday)),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: const Scaffold(body: SingleChildScrollView(child: MoodChips())),
      ),
    ),
  );
}

void main() {
  final en = AppLocalizationsEn();

  group('growthLabel', () {
    test('names the strength behind each seeded struggle', () {
      expect(growthLabel(en, 'kama'), 'Self-mastery');
      expect(growthLabel(en, 'krodha'), 'Calm');
      expect(growthLabel(en, 'lobha'), 'Contentment');
      expect(growthLabel(en, 'moha'), 'Clarity');
      expect(growthLabel(en, 'mada'), 'Humility');
      expect(growthLabel(en, 'matsarya'), 'Goodwill');
      expect(growthLabel(en, 'missed-chanting-time'), 'Chanting on time');
      expect(growthLabel(en, 'unmet-round-target'), 'Finishing my rounds');
    });

    test('is null for a slug the app has no name for, so the API name is used', () {
      expect(growthLabel(en, 'something-an-admin-added'), isNull);
      expect(growthLabelOr(en, 'something-an-admin-added', 'Restlessness'), 'Restlessness');
      expect(growthLabelOr(en, 'krodha', 'Anger'), 'Calm');
    });

    test('is worded in the reader\'s language, not copied from English', () {
      expect(growthLabel(AppLocalizationsHi(), 'krodha'), isNot('Calm'));
    });
  });

  group('growthReason', () {
    test('says what the verse is for, not what the reader got wrong', () {
      final sloka = personal(
        reason: 'Because you mentioned anger',
        issue: const SlokaIssue(slug: 'krodha', name: 'Anger'),
      );
      expect(growthReason(en, sloka), 'For your growth: Calm');
    });

    test('keeps the server\'s line when it cannot name the quality', () {
      final unknown = personal(
        reason: 'Because you mentioned restlessness',
        issue: const SlokaIssue(slug: 'restless', name: 'Restlessness'),
      );
      expect(growthReason(en, unknown), 'Because you mentioned restlessness');
      expect(growthReason(en, personal(reason: 'A verse for today')), 'A verse for today');
      expect(growthReason(en, personal()), isNull);
    });
  });

  group('the card', () {
    testWidgets('offers strengths to grow in, not faults', (tester) async {
      await pumpMoodCard(tester, issues: [
        issue('kama', 'Lust (Kama)'),
        issue('krodha', 'Anger (Krodha)'),
        issue('unmet-round-target', 'Could not finish my rounds', category: 'PRACTICE'),
      ]);
      await tester.pumpAndSettle();

      expect(find.text('Where would you like to grow today?'), findsOneWidget);
      expect(find.text('Choose what to strengthen, and a verse will walk with you.'), findsOneWidget);
      expect(find.text('Self-mastery'), findsOneWidget);
      expect(find.text('Calm'), findsOneWidget);
      expect(find.text('Finishing my rounds'), findsOneWidget);
      expect(find.textContaining('Lust'), findsNothing);
      expect(find.textContaining('Anger'), findsNothing);
      expect(find.textContaining('Could not'), findsNothing);
    });

    testWidgets('an issue with no growth name keeps the name it came with', (tester) async {
      await pumpMoodCard(tester, issues: [issue('restless', 'Restlessness')]);
      await tester.pumpAndSettle();

      expect(find.text('Restlessness'), findsOneWidget);
    });

    testWidgets('once today is chosen the hint gives way to the way back', (tester) async {
      await pumpMoodCard(
        tester,
        issues: [issue('krodha', 'Anger (Krodha)')],
        reportedToday: const ['krodha'],
      );
      await tester.pumpAndSettle();

      expect(find.text('Choose what to strengthen, and a verse will walk with you.'), findsNothing);
      expect(find.textContaining("You've chosen your focus for today"), findsOneWidget);
      expect(find.text('Calm'), findsOneWidget);
    });
  });
}
