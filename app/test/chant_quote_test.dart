// The quotes on the chanting page: which quote a count shows, the switch that
// chooses between the deity and the quotes, and the counter counting through
// the quote card. The quotes come from a fake provider, so no network.

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/chant_quote_config.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/quote.dart';
import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/providers/quote_provider.dart';
import 'package:hariharibol/providers/sadhana_provider.dart';
import 'package:hariharibol/services/chant_quote_rotation.dart';
import 'package:hariharibol/views/chant/chant_view.dart';
import 'package:hariharibol/widgets/chant/chant_disc.dart';
import 'package:hariharibol/widgets/chant/chant_quote_card.dart';
import 'package:hariharibol/widgets/chant/chant_view_switch.dart';

class _FakeToday extends SadhanaTodayNotifier {
  @override
  Future<SadhanaToday> build() async => const SadhanaToday(
        date: '2026-10-06',
        day: SadhanaDay(roundTarget: 16, roundsCompleted: 0, tasksTotal: 0, tasksDone: 0),
        tasks: [],
        sessions: [],
        streak: 0,
        beadsPerRound: 4,
      );
}

const _quotes = [
  Quote(id: 'a', text: 'First quote text.', reference: 'Bhagavad-gītā As It Is 6.6', sourceName: 'Vedabase', author: 'A. Teacher'),
  Quote(id: 'b', text: 'Second quote text.', reference: 'Śrīmad-Bhāgavatam 1.2.6', sourceName: 'Vedabase'),
  Quote(id: 'c', text: 'Third quote text.'),
];

Widget _app(Widget home, {List<Quote> quotes = _quotes, ProviderContainer? container}) {
  final app = MaterialApp(
    theme: AppTheme.light,
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    home: home,
  );
  if (container != null) return UncontrolledProviderScope(container: container, child: app);
  return ProviderScope(
    overrides: [chantQuotesProvider.overrideWith((ref) => Stream.value(quotes))],
    child: app,
  );
}

void main() {
  group('ChantQuoteRotation', () {
    test('a new quote after every 12 chants', () {
      expect(ChantQuoteConfig.chantsPerQuote, 12);
      expect(ChantQuoteRotation.stepOf(0), 0);
      expect(ChantQuoteRotation.stepOf(11), 0);
      expect(ChantQuoteRotation.stepOf(12), 1);
      expect(ChantQuoteRotation.stepOf(23), 1);
      expect(ChantQuoteRotation.stepOf(24), 2);
      // A round of 108 passes nine quotes.
      expect(ChantQuoteRotation.stepOf(108), 9);
      expect(ChantQuoteRotation.stepOf(-5), 0);
    });

    test('every quote is shown once before any repeats, then it comes round', () {
      final order = ChantQuoteRotation.order(5, 42);
      expect(order.toSet(), {0, 1, 2, 3, 4});
      final shown = [for (var step = 0; step < 5; step++) ChantQuoteRotation.indexFor(order: order, chants: step * 12)];
      expect(shown.toSet().length, 5);
      expect(ChantQuoteRotation.indexFor(order: order, chants: 5 * 12), shown.first);
    });

    test('the same seed gives the same order, and no quotes gives none', () {
      expect(ChantQuoteRotation.order(8, 7), ChantQuoteRotation.order(8, 7));
      expect(ChantQuoteRotation.indexFor(order: const [], chants: 30), isNull);
      expect(ChantQuoteRotation.order(0, 1), isEmpty);
    });

    test('an undo to below a multiple of 12 brings back the earlier quote', () {
      final order = ChantQuoteRotation.order(4, 3);
      final before = ChantQuoteRotation.indexFor(order: order, chants: 11);
      final after = ChantQuoteRotation.indexFor(order: order, chants: 12);
      expect(after, isNot(before));
      expect(ChantQuoteRotation.indexFor(order: order, chants: 11), before);
    });
  });

  group('Quote', () {
    test('reads what the API sends and skips a quote with no words', () {
      final list = Quote.listFromJson({
        'version': 'v1',
        'items': [
          {'id': 'q1', 'text': 'Chant.', 'language': 'hi', 'author': 'Someone', 'reference': 'BG 1.1', 'sourceName': 'Vedabase', 'sourceUrl': 'https://vedabase.io/'},
          {'id': 'q2', 'text': '   '},
          {'id': 'q3', 'text': 'Plain.'},
        ],
      });
      expect(list.map((q) => q.id), ['q1', 'q3']);
      expect(list.first.language, 'hi');
      expect(list.first.author, 'Someone');
      expect(list.last.language, 'en');
      expect(list.last.reference, isNull);
    });

    test('an answer with no items is an empty list', () {
      expect(Quote.listFromJson({}), isEmpty);
      expect(Quote.listFromJson({'items': 'oops'}), isEmpty);
    });
  });

  group('ChantPageView', () {
    test('is remembered by name, and anything else is the deity', () {
      expect(ChantPageView.fromStored(ChantPageView.quotes.stored), ChantPageView.quotes);
      expect(ChantPageView.fromStored(ChantPageView.deity.stored), ChantPageView.deity);
      expect(ChantPageView.fromStored(null), ChantPageView.deity);
      expect(ChantPageView.fromStored('something else'), ChantPageView.deity);
    });
  });

  testWidgets('the switch says Deity and Quotes and reports a choice', (tester) async {
    ChantPageView value = ChantPageView.deity;
    await tester.pumpWidget(
      _app(
        StatefulBuilder(
          builder: (context, setState) => Scaffold(
            body: ChantViewSwitch(value: value, onChanged: (view) => setState(() => value = view)),
          ),
        ),
      ),
    );

    expect(find.text('Deity'), findsOneWidget);
    expect(find.text('Quotes'), findsOneWidget);
    expect(find.byType(CupertinoSlidingSegmentedControl<ChantPageView>), findsOneWidget);

    await tester.tap(find.text('Quotes'));
    await tester.pumpAndSettle();
    expect(value, ChantPageView.quotes);
  });

  testWidgets('the card shows a quote with its reference and source, and not the author while it is hidden', (tester) async {
    var taps = 0;
    await tester.pumpWidget(_app(Scaffold(body: ChantQuoteCard(chants: 0, seed: 1, onTap: () => taps++))));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    final shown = _quotes.where((q) => find.text(q.text).evaluate().isNotEmpty).toList();
    expect(shown, hasLength(1));
    expect(find.text('A. Teacher'), findsNothing); // AppConfig.showQuoteAuthor is false
    expect(find.text('Tap the card to count a chant.'), findsOneWidget);

    await tester.tap(find.byType(ChantQuoteCard));
    expect(taps, 1);
  });

  testWidgets('with no quotes the card says so and still counts', (tester) async {
    var taps = 0;
    await tester.pumpWidget(_app(Scaffold(body: ChantQuoteCard(chants: 0, seed: 1, onTap: () => taps++)), quotes: const []));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('No quotes are available right now. You can keep counting.'), findsOneWidget);
    await tester.tap(find.byType(ChantQuoteCard));
    expect(taps, 1);
  });

  testWidgets('the counter opens on the deity, switches to quotes, and the quote changes after 12 chants', (tester) async {
    tester.view.physicalSize = const Size(400 * 3, 900 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final container = ProviderContainer(overrides: [
      sadhanaTodayProvider.overrideWith(_FakeToday.new),
      chantQuotesProvider.overrideWith((ref) => Stream.value(_quotes)),
    ]);
    addTearDown(container.dispose);
    await container.read(sadhanaTodayProvider.future);

    await tester.pumpWidget(_app(const ChantView(), container: container));
    await tester.pump();

    // The way the page has always been.
    expect(find.byType(ChantDisc), findsOneWidget);
    expect(find.byType(ChantQuoteCard), findsNothing);

    await tester.tap(find.text('Quotes'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1)); // the quotes arrive a frame after the card is built
    expect(find.byType(ChantDisc), findsNothing);
    expect(find.byType(ChantQuoteCard), findsOneWidget);

    String? visible() {
      final shown = _quotes.where((q) => find.text(q.text).evaluate().isNotEmpty).toList();
      return shown.length == 1 ? shown.single.id : null;
    }

    final first = visible();
    expect(first, isNotNull);

    // Eleven chants: still the same quote.
    for (var i = 0; i < 11; i++) {
      await tester.ensureVisible(find.byType(ChantQuoteCard));
      await tester.tap(find.byType(ChantQuoteCard));
      await tester.pump(const Duration(milliseconds: 50));
    }
    await tester.pump(const Duration(seconds: 1));
    expect(visible(), first);

    // The twelfth brings the next.
    await tester.tap(find.byType(ChantQuoteCard));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1)); // the old quote fades out as the new one fades in
    expect(visible(), isNotNull);
    expect(visible(), isNot(first));

    // And back to the deity.
    await tester.ensureVisible(find.text('Deity'));
    await tester.tap(find.text('Deity'));
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(ChantDisc), findsOneWidget);
    expect(find.byType(ChantQuoteCard), findsNothing);

    // Leave the screen so its timers are cancelled.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 3));
  });
}
