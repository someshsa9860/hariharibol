// The deity on the counter: shown at full strength in the middle of the ring
// with no number over it, the count on a line below, and one button on the
// picture that opens it full screen.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/models/reference_item.dart';
import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/providers/sadhana_provider.dart';
import 'package:hariharibol/views/chant/chant_fullscreen_view.dart';
import 'package:hariharibol/views/chant/chant_view.dart';
import 'package:hariharibol/widgets/chant/chant_disc.dart';
import 'package:hariharibol/widgets/chant/chant_disc_count.dart';
import 'package:hariharibol/widgets/common/animations.dart';
import 'package:hariharibol/widgets/dashboard/mala_ring.dart';

const String fullPictureTooltip = 'Full-screen picture';

Widget app(Widget home, {Brightness brightness = Brightness.light, ProviderContainer? container}) {
  final material = MaterialApp(
    theme: brightness == Brightness.light ? AppTheme.light : AppTheme.dark,
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    home: home,
  );
  return container == null ? material : UncontrolledProviderScope(container: container, child: material);
}

void phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(320 * 3, 640 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

ChantDisc disc({
  String? pictureUrl,
  VoidCallback? onTap,
  VoidCallback? onOpenPicture,
  int beads = 2,
  int rounds = 5,
}) {
  return ChantDisc(
    beadsInRound: beads,
    roundsCompleted: rounds,
    roundsLabel: 'Malas',
    beadsPerRound: 108,
    pulse: 0,
    onTap: onTap ?? () {},
    pictureUrl: pictureUrl,
    pictureKey: pictureUrl == null ? null : 'deity-test',
    onOpenPicture: onOpenPicture,
    openPictureTooltip: fullPictureTooltip,
  );
}

/// Whether anything inside [root] draws the text.
Finder textIn(Finder root, String text) => find.descendant(of: root, matching: find.text(text));

class _FakeToday extends SadhanaTodayNotifier {
  @override
  Future<SadhanaToday> build() async => const SadhanaToday(
        date: '2026-10-06',
        day: SadhanaDay(roundTarget: 0, roundsCompleted: 0, tasksTotal: 0, tasksDone: 0),
        tasks: [],
        sessions: [],
        streak: 0,
        beadsPerRound: 108,
      );
}

Mantra mantraWith(ReferenceItem deity) => Mantra(
      id: 'm',
      slug: 'm',
      name: 'Hare Krishna',
      text: 'Hare Krishna',
      textLanguage: 'en',
      durationMs: 4000,
      deity: deity,
    );

void main() {
  for (final brightness in Brightness.values) {
    group('the disc, ${brightness.name}', () {
      testWidgets('without a picture the count is the middle, as it was', (tester) async {
        phone(tester);
        await tester.pumpWidget(app(Center(child: disc()), brightness: brightness));

        expect(textIn(find.byType(MalaRing), '5'), findsOneWidget);
        expect(textIn(find.byType(MalaRing), '2 / 108'), findsOneWidget);
        expect(find.byType(ChantDiscCount), findsNothing);
        expect(find.byIcon(Icons.fullscreen_rounded), findsNothing);
      });

      testWidgets('with a picture the ring is empty, the picture is not faded and the count is below',
          (tester) async {
        phone(tester);
        await tester.pumpWidget(
          app(Center(child: disc(pictureUrl: 'https://example.test/d.jpg')), brightness: brightness),
        );

        expect(find.descendant(of: find.byType(MalaRing), matching: find.byType(Text)), findsNothing);
        expect(textIn(find.byType(ChantDiscCount), '5'), findsOneWidget);
        expect(textIn(find.byType(ChantDiscCount), '2 / 108'), findsOneWidget);

        // Nothing sits over the picture to dim it.
        expect(find.ancestor(of: find.byType(ClipOval), matching: find.byType(Opacity)), findsNothing);
        expect(tester.takeException(), isNull);
      });

      testWidgets('the count line fits at a large text size', (tester) async {
        phone(tester);
        await tester.pumpWidget(
          app(
            Builder(
              builder: (context) => MediaQuery(
                data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(2)),
                child: Center(child: disc(pictureUrl: 'https://example.test/d.jpg', rounds: 108)),
              ),
            ),
            brightness: brightness,
          ),
        );

        expect(tester.takeException(), isNull);
      });
    });
  }

  group('the expand button', () {
    testWidgets('opens the picture and is not a bead', (tester) async {
      phone(tester);
      var beads = 0;
      var opened = 0;
      await tester.pumpWidget(
        app(
          Center(
            child: disc(
              pictureUrl: 'https://example.test/d.jpg',
              onTap: () => beads++,
              onOpenPicture: () => opened++,
            ),
          ),
        ),
      );

      expect(find.byTooltip(fullPictureTooltip), findsOneWidget);
      await tester.tap(find.byIcon(Icons.fullscreen_rounded));
      await tester.pump();
      expect(opened, 1);
      expect(beads, 0);

      // Anywhere else on the disc is still a bead.
      await tester.tap(find.byType(TapScale));
      await tester.pump();
      expect(beads, 1);
      expect(opened, 1);
    });

    testWidgets('is on the picture, inside the disc', (tester) async {
      phone(tester);
      await tester.pumpWidget(
        app(Center(child: disc(pictureUrl: 'https://example.test/d.jpg', onOpenPicture: () {}))),
      );

      final discBox = tester.getRect(find.byType(TapScale));
      final button = tester.getRect(find.byType(IconButton));
      expect(discBox.contains(button.center), isTrue);
      expect(button.center.dx, greaterThan(discBox.center.dx));
      expect(button.center.dy, greaterThan(discBox.center.dy));
      expect(discBox.inflate(0.5).contains(button.topLeft), isTrue);
      expect(discBox.inflate(0.5).contains(button.bottomRight), isTrue);
    });

    testWidgets('is not drawn with no picture to open', (tester) async {
      phone(tester);
      await tester.pumpWidget(app(Center(child: disc(onOpenPicture: () {}))));
      expect(find.byType(IconButton), findsNothing);
    });
  });

  group('on the counter', () {
    Future<void> open(WidgetTester tester, ReferenceItem deity) async {
      phone(tester);
      final container = ProviderContainer(overrides: [sadhanaTodayProvider.overrideWith(_FakeToday.new)]);
      addTearDown(container.dispose);
      await container.read(sadhanaTodayProvider.future);
      await tester.pumpWidget(app(ChantView(mantra: mantraWith(deity)), container: container));
      await tester.pump();
      await tester.ensureVisible(find.byType(TapScale));
      await tester.pump();
    }

    Future<void> leave(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 3));
    }

    testWidgets('a deity with only a list picture still opens it, uncropped', (tester) async {
      await open(
        tester,
        const ReferenceItem(id: 'd', slug: 'd', name: 'Krishna', imageUrl: 'https://example.test/list.jpg'),
      );

      await tester.tap(find.byIcon(Icons.fullscreen_rounded));
      await tester.pumpAndSettle();

      final view = tester.widget<ChantFullscreenView>(find.byType(ChantFullscreenView));
      expect(view.imageUrl, 'https://example.test/list.jpg');
      expect(view.fit, BoxFit.contain);

      await tester.tap(find.byIcon(Icons.close_rounded));
      await tester.pumpAndSettle();
      await leave(tester);
    });

    testWidgets('a deity with a 9:16 picture opens that, filling the screen', (tester) async {
      await open(
        tester,
        const ReferenceItem(
          id: 'd',
          slug: 'd',
          name: 'Krishna',
          imageUrl: 'https://example.test/list.jpg',
          fullImageUrl: 'https://example.test/full.jpg',
        ),
      );

      await tester.tap(find.byIcon(Icons.fullscreen_rounded));
      await tester.pumpAndSettle();

      final view = tester.widget<ChantFullscreenView>(find.byType(ChantFullscreenView));
      expect(view.imageUrl, 'https://example.test/full.jpg');
      expect(view.fit, BoxFit.cover);

      await tester.tap(find.byIcon(Icons.close_rounded));
      await tester.pumpAndSettle();
      await leave(tester);
    });

    testWidgets('a deity with only the 9:16 picture is shown in the ring too', (tester) async {
      await open(
        tester,
        const ReferenceItem(id: 'd', slug: 'd', name: 'Krishna', fullImageUrl: 'https://example.test/full.jpg'),
      );

      expect(find.byType(ChantDiscCount), findsOneWidget);
      expect(find.byIcon(Icons.fullscreen_rounded), findsOneWidget);
      await leave(tester);
    });

    testWidgets('a deity with no picture leaves the count in the ring', (tester) async {
      await open(tester, const ReferenceItem(id: 'd', slug: 'd', name: 'Krishna'));

      expect(find.byType(ChantDiscCount), findsNothing);
      expect(find.byIcon(Icons.fullscreen_rounded), findsNothing);
      expect(textIn(find.byType(MalaRing), '0 / 108'), findsOneWidget);
      await leave(tester);
    });
  });
}
