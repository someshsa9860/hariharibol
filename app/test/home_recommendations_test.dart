// The three sections added to the end of Home: verses for the vikaras the reader
// reported, this week's festivals, and the prayers for this time of day. The
// choosing is pure (tested here by the clock and the list), and the rows are
// drawn at a large text size, where a fixed height would overflow.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/home_config.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/calendar.dart';
import 'package:hariharibol/models/home_issue_verse.dart';
import 'package:hariharibol/models/prayer.dart';
import 'package:hariharibol/providers/home_week_provider.dart';
import 'package:hariharibol/widgets/dashboard/issue_verses_row.dart';
import 'package:hariharibol/widgets/dashboard/time_of_day_prayers_row.dart';
import 'package:hariharibol/widgets/dashboard/week_festivals_row.dart';

CalendarFestival _festival(String date, String name) => CalendarFestival.fromJson({
      'date': date,
      'slug': name.toLowerCase().replaceAll(' ', '-'),
      'kind': 'FESTIVAL',
      'name': name,
    });

Prayer _prayer(String id, String category) => Prayer.fromJson({
      'id': id,
      'slug': id,
      'category': category,
      'title': 'Prayer $id',
      'summary': 'A short summary of prayer $id.',
      'sourceLanguage': 'sa',
      'verseCount': 2,
    });

HomeIssueVerse _issueVerse() => HomeIssueVerse.fromJson({
      'issue': {'id': 'i1', 'slug': 'krodha', 'name': 'Anger', 'category': 'VIKARA'},
      'verse': {
        'id': 'v1',
        'verseId': '2.62',
        'bookNumber': 1,
        'chapterNumber': 2,
        'verseNumber': 62,
        'sanskrit': 'ध्यायतो विषयान्पुंसः सङ्गस्तेषूपजायते',
        'translation': {'meaning': 'Brooding on sense objects breeds attachment.'},
        'book': {'id': 'b1', 'slug': 'bhagavad-gita', 'title': 'Bhagavad Gita', 'bookNumber': 1},
      },
    });

void main() {
  group('festivalsThisWeek', () {
    final now = DateTime(2026, 11, 2, 9);

    test('keeps today through the next six days, soonest first', () {
      final kept = festivalsThisWeek([
        _festival('2026-11-01', 'Yesterday'),
        _festival('2026-11-02', 'Today'),
        _festival('2026-11-08', 'Last day of the week'),
        _festival('2026-11-09', 'Next week'),
      ], now);
      expect(kept.map((f) => f.name), ['Today', 'Last day of the week']);
    });

    test('is empty when nothing falls in the week', () {
      expect(festivalsThisWeek([_festival('2026-12-01', 'Far')], now), isEmpty);
    });

    test('the week is the configured number of days', () {
      expect(HomeConfig.festivalWeekDays, 7);
    });
  });

  group('timeOfDayPrayerCategory', () {
    test('morning before noon, evening from five, nothing between', () {
      expect(timeOfDayPrayerCategory(DateTime(2026, 1, 1, 0, 30)), 'morning');
      expect(timeOfDayPrayerCategory(DateTime(2026, 1, 1, 11, 59)), 'morning');
      expect(timeOfDayPrayerCategory(DateTime(2026, 1, 1, 12)), isNull);
      expect(timeOfDayPrayerCategory(DateTime(2026, 1, 1, 16, 59)), isNull);
      expect(timeOfDayPrayerCategory(DateTime(2026, 1, 1, 17)), 'evening');
      expect(timeOfDayPrayerCategory(DateTime(2026, 1, 1, 23, 45)), 'evening');
    });
  });

  group('timeOfDayPrayers', () {
    final prayers = [
      _prayer('a', 'morning'),
      _prayer('b', 'evening'),
      _prayer('c', 'morning'),
      _prayer('d', 'morning'),
      _prayer('e', 'morning'),
    ];

    test('offers only the category of the hour, up to the row count', () {
      final morning = timeOfDayPrayers(prayers, DateTime(2026, 1, 1, 8));
      expect(morning.map((p) => p.id), ['a', 'c', 'd']);
      expect(morning.length, HomeConfig.timeOfDayPrayerCount);

      expect(timeOfDayPrayers(prayers, DateTime(2026, 1, 1, 19)).map((p) => p.id), ['b']);
    });

    test('is empty at midday', () {
      expect(timeOfDayPrayers(prayers, DateTime(2026, 1, 1, 13)), isEmpty);
    });
  });

  group('HomeIssueVerse.fromJson', () {
    test('reads the vikara and the verse', () {
      final item = _issueVerse();
      expect(item.issue.slug, 'krodha');
      expect(item.issue.name, 'Anger');
      expect(item.verse.id, 'v1');
      expect(item.verse.translation?.meaning, startsWith('Brooding'));
    });
  });

  group('rows at a large text size', () {
    Future<void> pump(WidgetTester tester, Widget row) async {
      tester.view.physicalSize = const Size(402 * 3, 874 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.6)),
            child: child!,
          ),
          home: Scaffold(body: Padding(padding: const EdgeInsets.all(16), child: row)),
        ),
      );
    }

    testWidgets('the verse row shows the vikara name and does not overflow', (tester) async {
      await pump(tester, IssueVersesRow(items: [_issueVerse(), _issueVerse()]));
      expect(find.text('Anger'), findsNWidgets(2));
      expect(tester.takeException(), isNull);
    });

    testWidgets('the festival row draws a card per festival', (tester) async {
      await pump(
        tester,
        WeekFestivalsRow(festivals: [
          _festival('2026-11-02', 'Ekadashi'),
          _festival('2026-11-05', 'Chaturthi'),
        ]),
      );
      expect(find.text('Ekadashi'), findsOneWidget);
      expect(find.text('Chaturthi'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the prayer row draws the prayer titles and does not overflow', (tester) async {
      await pump(tester, TimeOfDayPrayersRow(prayers: [_prayer('a', 'morning')]));
      expect(find.text('Prayer a'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
