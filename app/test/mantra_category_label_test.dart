// A mantra's category arrives as a slug ("mahamantra"). The Chant tab's filter
// chips, the pill on each mantra and the card's eyebrow used to print it
// title-cased, in English, whatever language the reader had chosen. These
// tests guard that seam: the four categories the seed publishes under come
// from the ARB in every shipped language, and a category an admin adds later
// still shows as something readable.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/models/mantra_category.dart';
import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/providers/mantra_provider.dart';
import 'package:hariharibol/providers/sadhana_provider.dart';
import 'package:hariharibol/views/dashboard/sadhana_tab.dart';
import 'package:hariharibol/views/mantra/mantra_detail_view.dart';
import 'package:hariharibol/widgets/dashboard/mantra_card.dart';
import 'package:hariharibol/widgets/dashboard/mantra_category_label.dart';

const seeded = [
  MantraCategory.beej,
  MantraCategory.gayatri,
  MantraCategory.mahamantra,
  MantraCategory.name,
];

class _FakeToday extends SadhanaTodayNotifier {
  @override
  Future<SadhanaToday> build() async => const SadhanaToday(
        date: '2026-10-11',
        day: SadhanaDay(roundTarget: 16, roundsCompleted: 0, tasksTotal: 0, tasksDone: 0),
        tasks: [],
        sessions: [],
        streak: 0,
        beadsPerRound: 108,
      );
}

Future<AppLocalizations> load(String code) => AppLocalizations.delegate.load(Locale(code));

Widget app(Widget home, {required String locale, List<Override> overrides = const []}) =>
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        theme: AppTheme.light,
        locale: Locale(locale),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

Mantra mantra(String slug, String name, String category) => Mantra(
      id: slug,
      slug: slug,
      name: name,
      text: 'हरे कृष्ण',
      textLanguage: 'sa',
      category: category,
    );

void main() {
  group('mantraCategoryLabel', () {
    test('English readers see the words they always did', () async {
      final english = await load('en');
      expect(
        [for (final slug in seeded) mantraCategoryLabel(english, slug)],
        ['Beej', 'Gayatri', 'Mahamantra', 'Name'],
      );
    });

    test('every shipped language names all four, and none of them in English', () async {
      final english = await load('en');
      for (final locale in AppLocalizations.supportedLocales) {
        if (locale.languageCode == 'en') continue;
        final text = await load(locale.languageCode);

        final labels = [for (final slug in seeded) mantraCategoryLabel(text, slug)];
        for (var i = 0; i < seeded.length; i++) {
          expect(labels[i], isNotEmpty, reason: '${locale.languageCode} ${seeded[i]}');
          expect(
            labels[i],
            isNot(mantraCategoryLabel(english, seeded[i])),
            reason: '${locale.languageCode} ${seeded[i]} is still the English word',
          );
        }
        // Two slugs wired to one text would make two chips read the same.
        expect(labels.toSet(), hasLength(seeded.length), reason: locale.languageCode);
      }
    });

    test('a Marathi reader gets Marathi, not the slug', () async {
      final marathi = await load('mr');
      expect(mantraCategoryLabel(marathi, 'beej'), 'बीजमंत्र');
      expect(mantraCategoryLabel(marathi, 'gayatri'), 'गायत्री');
      expect(mantraCategoryLabel(marathi, 'mahamantra'), 'महामंत्र');
      expect(mantraCategoryLabel(marathi, 'name'), 'नाममंत्र');
    });

    test('a category an admin added is shown as its slug, title-cased', () async {
      final marathi = await load('mr');
      expect(mantraCategoryLabel(marathi, 'bhajan'), 'Bhajan');
      expect(mantraCategoryLabel(marathi, 'kirtan-mantra'), 'Kirtan-mantra');
      expect(mantraCategoryLabel(marathi, ''), '');
    });

    test('capitals and stray spaces do not hide a seeded category', () async {
      final marathi = await load('mr');
      expect(mantraCategoryLabel(marathi, ' Gayatri '), 'गायत्री');
      expect(mantraCategoryLabel(marathi, 'MAHAMANTRA'), 'महामंत्र');
    });
  });

  group('on screen, in Marathi', () {
    testWidgets('the Chant tab words its chips and pills in Marathi', (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 1800 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        app(
          const SadhanaTab(),
          locale: 'mr',
          overrides: [
            sadhanaTodayProvider.overrideWith(_FakeToday.new),
            mantraCategoriesProvider.overrideWith(
              (ref) => Stream.value([for (final slug in seeded) MantraCategory(slug: slug, count: 1)]),
            ),
            mantraListProvider.overrideWith(
              (ref, category) => Stream.value([
                mantra('hare-krishna', 'हरे कृष्ण महामंत्र', 'mahamantra'),
                mantra('rama-taraka', 'राम तारक मंत्र', 'name'),
              ]),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // A chip each, and for the two categories that have a mantra listed, the
      // pill on it as well.
      expect(find.text('सर्व'), findsOneWidget);
      expect(find.text('बीजमंत्र'), findsOneWidget);
      expect(find.text('गायत्री'), findsOneWidget);
      expect(find.text('महामंत्र'), findsNWidgets(2));
      expect(find.text('नाममंत्र'), findsNWidgets(2));

      for (final english in ['Beej', 'Gayatri', 'Mahamantra', 'Name', 'mahamantra', 'name']) {
        expect(find.text(english), findsNothing, reason: english);
      }
    });

    testWidgets('a mantra card words its category in Marathi', (tester) async {
      await tester.pumpWidget(
        app(
          Scaffold(body: MantraCard(mantra: mantra('om', 'ॐ', 'beej'))),
          locale: 'mr',
        ),
      );
      expect(find.text('बीजमंत्र'), findsOneWidget);
      expect(find.text('BEEJ'), findsNothing);
    });

    testWidgets('a mantra page words its category in Marathi', (tester) async {
      await tester.pumpWidget(
        app(
          const MantraDetailView(slug: 'om'),
          locale: 'mr',
          overrides: [
            mantraDetailProvider.overrideWith((ref, slug) => Stream.value(mantra('om', 'ॐ', 'beej'))),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('बीजमंत्र'), findsOneWidget);
      expect(find.text('BEEJ'), findsNothing);
    });
  });
}
