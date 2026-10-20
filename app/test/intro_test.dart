// The welcome pages themselves: what is on each, how they turn, how a page
// arrives, that every picture draws and loops without a seam, and that they
// hold up on a small phone at the largest text size in every language the app
// ships.
//
// Where they are shown — once, before sign-in, never again — is in
// `auth_flow_test.dart`.
//
// Time is driven by hand. Both clocks of a page repeat, so `pumpAndSettle`
// would never return (except under reduced motion, where nothing repeats), and
// the last button comes in on a 330 ms timer, so every test pumps past that
// before it ends.

import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/intro_config.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/views/onboarding/intro_view.dart';
import 'package:hariharibol/widgets/intro/intro_backdrop.dart';
import 'package:hariharibol/widgets/intro/intro_indicator.dart';
import 'package:hariharibol/widgets/intro/intro_text.dart';
import 'package:hariharibol/widgets/intro/scene_chant.dart';
import 'package:hariharibol/widgets/intro/scene_read.dart';
import 'package:hariharibol/widgets/intro/scene_reels.dart';
import 'package:hariharibol/widgets/intro/scene_sakha.dart';
import 'package:hariharibol/widgets/intro/scene_welcome.dart';

/// The picture of each page, in page order.
const List<Type> sceneTypes = [WelcomeScene, ReadScene, ChantScene, SakhaScene, ReelsScene];

typedef SceneBuilder = Widget Function(Animation<double> enter, Animation<double> loop);

/// The pictures by name, each given the two clocks of its page.
final Map<String, SceneBuilder> pictures = {
  'welcome': (enter, loop) => WelcomeScene(enter: enter, loop: loop),
  'read': (enter, loop) => ReadScene(enter: enter, loop: loop),
  'chant': (enter, loop) => ChantScene(enter: enter, loop: loop),
  'sakha': (enter, loop) => SakhaScene(enter: enter, loop: loop),
  'reels': (enter, loop) => ReelsScene(enter: enter, loop: loop),
};

/// Long enough for a page's entrance to have finished, and for the last
/// button's staggered start (330 ms) to have fired.
const Duration arrival = Duration(milliseconds: IntroConfig.enterMs + 300);

const Size phoneSize = Size(390, 844);

List<String> titlesOf(AppLocalizations t) => [
  t.introWelcomeTitle,
  t.introReadTitle,
  t.introChantTitle,
  t.introSakhaTitle,
  t.introReelsTitle,
];

List<String> bodiesOf(AppLocalizations t) => [
  t.introWelcomeBody,
  t.introReadBody,
  t.introChantBody,
  t.introSakhaBody,
  t.introReelsBody,
];

Future<AppLocalizations> english() => AppLocalizations.delegate.load(const Locale('en'));

Widget app({
  Widget home = const IntroView(),
  Brightness brightness = Brightness.light,
  Locale locale = const Locale('en'),
  double textScale = 1,
  bool reduceMotion = false,
}) {
  return MaterialApp(
    theme: brightness == Brightness.light ? AppTheme.light : AppTheme.dark,
    locale: locale,
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(
        textScaler: TextScaler.linear(textScale),
        disableAnimations: reduceMotion,
      ),
      child: child!,
    ),
    home: home,
  );
}

void screen(WidgetTester tester, [Size size = phoneSize]) {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

Future<void> open(
  WidgetTester tester, {
  Brightness brightness = Brightness.light,
  Locale locale = const Locale('en'),
  double textScale = 1,
  bool reduceMotion = false,
}) async {
  await tester.pumpWidget(
    app(brightness: brightness, locale: locale, textScale: textScale, reduceMotion: reduceMotion),
  );
  await tester.pump();
  await tester.pump(arrival);
}

/// The Next button, and the turn it starts, until the new page has arrived.
Future<void> next(WidgetTester tester) async {
  await tester.tap(find.byType(FilledButton));
  await tester.pump();
  await tester.pump(IntroConfig.pageTurn);
  await tester.pump(arrival);
}

/// A swipe, forward (towards the next page) or back, and the settling after it.
Future<void> swipe(WidgetTester tester, {required bool forward}) async {
  await tester.fling(find.byType(PageView), Offset(forward ? -300 : 300, 0), 1200);
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(arrival);
}

/// The title on screen; only for a moment when one page is showing.
String shownTitle(WidgetTester tester) => tester.widget<IntroTitle>(find.byType(IntroTitle)).text;

/// The words of a title that are still on their way in: each one that has not
/// finished is wrapped in an `Opacity`, and a finished one is a plain `Text`.
Finder get wordsOnTheirWay => find.descendant(of: find.byType(IntroTitle), matching: find.byType(Opacity));

double bodyOpacity(WidgetTester tester, String body) => tester
    .widget<Opacity>(find.ancestor(of: find.text(body), matching: find.byType(Opacity)).first)
    .opacity;

double middleOf(WidgetTester tester) => tester.view.physicalSize.width / tester.view.devicePixelRatio / 2;

/// The words under [within] as the lines they are set in, top to bottom.
List<List<String>> linesOf(WidgetTester tester, Finder within) {
  final words = find.descendant(of: within, matching: find.byType(Text));
  final rows = <int, List<String>>{};
  for (var i = 0; i < words.evaluate().length; i++) {
    final word = words.at(i);
    rows.putIfAbsent(tester.getTopLeft(word).dy.round(), () => []).add(tester.widget<Text>(word).data!);
  }
  return [for (final top in rows.keys.toList()..sort()) rows[top]!];
}

/// How many lines a real `Wrap` makes of words as wide as [widths], [gap] apart,
/// in a box [width] across.
Future<int> wrapLines(WidgetTester tester, List<double> widths, double gap, double width) async {
  const height = 10.0;
  await tester.pumpWidget(
    Directionality(
      textDirection: TextDirection.ltr,
      child: Align(
        alignment: Alignment.topLeft,
        child: SizedBox(
          width: width,
          child: Wrap(spacing: gap, children: [for (final w in widths) SizedBox(width: w, height: height)]),
        ),
      ),
    ),
  );
  return tester.getSize(find.byType(Wrap)).height ~/ height;
}

/// Fails with everything the framework caught while building, laying out or
/// painting — all of the message, not the first line `expect(…, isNull)` shows,
/// since which widget overflowed is the part worth knowing.
void noErrors(WidgetTester tester, [String where = '']) {
  final error = tester.takeException();
  if (error == null) return;
  final detail = error is FlutterError ? error.diagnostics.map((node) => node.toStringDeep()).join('\n') : '$error';
  fail(where.isEmpty ? detail : '$where\n$detail');
}

void main() {
  group('the pages', () {
    testWidgets('open on the welcome, with a way on and a way out', (tester) async {
      screen(tester);
      final text = await english();
      await open(tester);

      expect(shownTitle(tester), text.introWelcomeTitle);
      expect(find.text(text.introWelcomeBody), findsOneWidget);
      expect(find.byType(WelcomeScene), findsOneWidget);
      expect(find.widgetWithText(FilledButton, text.introNext), findsOneWidget);
      expect(find.widgetWithText(TextButton, text.introSkip), findsOneWidget);
      noErrors(tester);
    });

    testWidgets('Next goes through the five pages in order, each with its own picture', (tester) async {
      screen(tester);
      final text = await english();
      final titles = titlesOf(text);
      final bodies = bodiesOf(text);
      expect(titles.toSet(), hasLength(IntroConfig.pageCount));
      expect(sceneTypes, hasLength(IntroConfig.pageCount));
      await open(tester);

      for (var page = 0; page < IntroConfig.pageCount; page++) {
        expect(shownTitle(tester), titles[page], reason: 'title of page ${page + 1}');
        expect(find.text(bodies[page]), findsOneWidget, reason: 'line of page ${page + 1}');
        for (var picture = 0; picture < sceneTypes.length; picture++) {
          expect(
            find.byType(sceneTypes[picture]),
            picture == page ? findsOneWidget : findsNothing,
            reason: 'picture ${picture + 1} on page ${page + 1}',
          );
        }
        if (page < IntroConfig.pageCount - 1) await next(tester);
      }
      noErrors(tester);
    });

    testWidgets('the last page says Get started and takes Skip away', (tester) async {
      screen(tester);
      final handle = tester.ensureSemantics();
      final text = await english();
      await open(tester);

      expect(find.semantics.byLabel(text.introSkip), findsOneWidget);
      expect(find.text(text.introStart), findsNothing);

      for (var page = 1; page < IntroConfig.pageCount; page++) {
        await next(tester);
      }

      expect(find.text(text.introStart), findsOneWidget);
      expect(find.text(text.introNext), findsNothing);
      // Still in its place so nothing under it moves, but neither seen, touched
      // nor read out.
      expect(find.text(text.introSkip).hitTestable(), findsNothing);
      expect(find.semantics.byLabel(text.introSkip), findsNothing);
      handle.dispose();
    });

    testWidgets('a swipe turns the page too, and neither end goes on', (tester) async {
      screen(tester);
      final titles = titlesOf(await english());
      await open(tester);

      await swipe(tester, forward: false);
      expect(shownTitle(tester), titles.first, reason: 'nothing comes before the first page');

      await swipe(tester, forward: true);
      expect(shownTitle(tester), titles[1]);
      await swipe(tester, forward: false);
      expect(shownTitle(tester), titles[0]);

      for (var page = 1; page < IntroConfig.pageCount; page++) {
        await swipe(tester, forward: true);
        expect(shownTitle(tester), titles[page]);
      }
      await swipe(tester, forward: true);
      expect(shownTitle(tester), titles.last, reason: 'nothing comes after the last page');
      noErrors(tester);
    });

    testWidgets('after every turn the picture and the title are back in the middle', (tester) async {
      screen(tester);
      await open(tester);

      for (var page = 0; page < IntroConfig.pageCount; page++) {
        expect(tester.getCenter(find.byType(sceneTypes[page])).dx, closeTo(middleOf(tester), 0.5));
        expect(tester.getCenter(find.byType(IntroTitle)).dx, closeTo(middleOf(tester), 0.5));
        if (page < IntroConfig.pageCount - 1) await next(tester);
      }
    });

    testWidgets('while a page is dragged the words travel faster than the picture', (tester) async {
      screen(tester);
      await open(tester);

      final gesture = await tester.startGesture(tester.getCenter(find.byType(PageView)));
      // The first of it is taken up by the touch slop; the rest is the page.
      await gesture.moveBy(const Offset(-120, 0));
      await gesture.moveBy(const Offset(-120, 0));
      await tester.pump();

      final picture = tester.getCenter(find.byType(WelcomeScene)).dx;
      final words = tester.getCenter(find.byType(IntroTitle).first).dx;
      expect(picture, lessThan(middleOf(tester)), reason: 'the picture goes with the finger');
      expect(words, lessThan(picture), reason: 'the words go further');
      expect(find.byType(ReadScene), findsOneWidget, reason: 'the next page is already coming in');

      await gesture.up();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(arrival);
    });

    testWidgets('the dots follow the finger and say where the person is', (tester) async {
      screen(tester);
      final handle = tester.ensureSemantics();
      final text = await english();
      await open(tester);

      final dots = tester.widget<IntroIndicator>(find.byType(IntroIndicator)).position;
      expect(dots.value, 0);
      expect(find.semantics.byLabel(text.introPageOf(1, IntroConfig.pageCount)), findsOneWidget);

      final gesture = await tester.startGesture(tester.getCenter(find.byType(PageView)));
      await gesture.moveBy(const Offset(-120, 0));
      await gesture.moveBy(const Offset(-120, 0));
      await tester.pump();
      expect(dots.value, inExclusiveRange(0.2, 0.8), reason: 'between the first dot and the second');

      await gesture.up();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(arrival);
      expect(dots.value, 1);
      expect(find.semantics.byLabel(text.introPageOf(2, IntroConfig.pageCount)), findsOneWidget);
      expect(find.semantics.byLabel(text.introPageOf(1, IntroConfig.pageCount)), findsNothing);
      handle.dispose();
    });

    testWidgets('a title is one heading to a screen reader, whole', (tester) async {
      screen(tester);
      final handle = tester.ensureSemantics();
      final text = await english();
      await open(tester);

      final title = text.introWelcomeTitle;
      expect(find.semantics.byLabel(title), findsOneWidget);
      expect(find.semantics.byLabel(title).evaluate().single, isSemantics(label: title, isHeader: true));
      handle.dispose();
    });

    testWidgets('the button changes its words by one going before the other arrives', (tester) async {
      screen(tester);
      final text = await english();
      await open(tester);
      for (var page = 1; page < IntroConfig.pageCount - 1; page++) {
        await next(tester);
      }
      expect(find.text(text.introNext), findsOneWidget);

      // How much of a label shows: the fade nearest to it, 0 if it isn't there.
      double shown(String label) {
        final fades = find.ancestor(of: find.text(label), matching: find.byType(FadeTransition));
        return fades.evaluate().isEmpty ? 0 : tester.widget<FadeTransition>(fades.first).opacity.value;
      }

      // The last turn, a frame at a time.
      await tester.tap(find.byType(FilledButton));
      await tester.pump();
      var seenLeaving = false;
      var seenArriving = false;
      for (var ms = 20; ms <= 1000; ms += 20) {
        await tester.pump(const Duration(milliseconds: 20));
        final old = shown(text.introNext);
        final fresh = shown(text.introStart);
        expect(old > 0 && fresh > 0, isFalse, reason: 'at $ms ms both show: $old and $fresh');
        if (old > 0 && old < 1) seenLeaving = true;
        if (fresh > 0 && fresh < 1) seenArriving = true;
      }
      expect(seenLeaving, isTrue, reason: 'the old words fade rather than cut');
      expect(seenArriving, isTrue, reason: 'the new words fade in rather than cut');
      expect(shown(text.introStart), 1);
      expect(find.text(text.introNext), findsNothing);
      noErrors(tester);
    });
  });

  group('the title', () {
    testWidgets('balancedWidth keeps the lines a Wrap makes and takes the width in as far as it can', (tester) async {
      const gap = 8.0;
      final cases = <(List<double>, double)>[
        ([30, 60, 10, 50, 20, 30, 40], 250), // ends on a word of its own
        ([100, 20, 20], 120), // the widest word is as narrow as it gets
        ([40, 40], 200), // one line already
        ([70, 70, 70, 70, 70, 70], 300), // even already
        ([20, 25, 30, 35, 40, 45, 50, 55], 160), // three lines
      ];

      for (final (widths, limit) in cases) {
        final lines = await wrapLines(tester, widths, gap, limit);
        final balanced = balancedWidth(widths, gap, limit);
        final widest = widths.reduce(math.max);

        expect(balanced, inInclusiveRange(widest, limit), reason: '$widths in $limit');
        expect(await wrapLines(tester, widths, gap, balanced), lines, reason: '$widths held to $balanced');
        if (lines > 1 && balanced - 1 >= widest) {
          expect(
            await wrapLines(tester, widths, gap, balanced - 1),
            greaterThan(lines),
            reason: '$widths could not be held to ${balanced - 1}',
          );
        }
      }
    });

    test('balancedWidth leaves a single word, an unbounded box and a single line alone', () {
      expect(balancedWidth([80], 8, 200), 200);
      expect(balancedWidth([30, 60], 8, double.infinity), double.infinity);
      expect(balancedWidth([30, 60, 40], 8, 300), 300);
    });

    testWidgets('a title that has to wrap is broken evenly, never ending on a word of its own', (tester) async {
      const title = 'Ask Sakha, a friend on the path';
      const style = TextStyle(fontSize: 10);
      const width = 250.0;

      Future<List<List<String>>> setIn({required bool evenly, required double scale}) async {
        await tester.pumpWidget(
          app(
            textScale: scale,
            home: Scaffold(
              body: Align(
                alignment: Alignment.topCenter,
                child: SizedBox(
                  width: width,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (evenly)
                        const IntroTitle(text: title, enter: AlwaysStoppedAnimation<double>(1), style: style)
                      else
                        Wrap(
                          alignment: WrapAlignment.center,
                          spacing: 10 * IntroConfig.wordGap,
                          children: [for (final word in title.split(' ')) Text(word, style: style)],
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pump();
        return linesOf(tester, find.byType(evenly ? IntroTitle : Wrap));
      }

      for (final scale in [1.0, 1.5, 2.0]) {
        final plain = await setIn(evenly: false, scale: scale);
        final even = await setIn(evenly: true, scale: scale);

        if (scale == 1) expect(plain.last, hasLength(1), reason: 'left alone the title ends on one word');
        expect(even.expand((line) => line).join(' '), title, reason: 'every word, in order, at $scale');
        // The same number of lines also shows the words were measured the way the
        // text is drawn: at a larger text size a measure that ignored it would
        // squeeze the title into more.
        expect(even, hasLength(plain.length), reason: 'no extra line at $scale');
        if (plain.last.length == 1) {
          expect(even.last.length, greaterThan(1), reason: 'the last line at $scale: $even');
        }
      }
    });
  });

  group('the entrance', () {
    testWidgets('the title comes in a word at a time and the line under it after', (tester) async {
      screen(tester);
      final text = await english();
      final words = text.introWelcomeTitle.split(' ').length;
      await tester.pumpWidget(app());
      await tester.pump();

      expect(wordsOnTheirWay, findsNWidgets(words), reason: 'none has arrived yet');
      expect(bodyOpacity(tester, text.introWelcomeBody), 0);

      await tester.pump(const Duration(milliseconds: 1100));
      expect(wordsOnTheirWay, findsNWidgets(words - 1), reason: 'the first is in, the others on their way');
      expect(bodyOpacity(tester, text.introWelcomeBody), inExclusiveRange(0, 1));

      await tester.pump(arrival);
      expect(wordsOnTheirWay, findsNothing);
      expect(bodyOpacity(tester, text.introWelcomeBody), 1);
    });

    testWidgets('a page plays it again when it is come back to', (tester) async {
      screen(tester);
      final titles = titlesOf(await english());
      await open(tester);
      expect(wordsOnTheirWay, findsNothing);

      await next(tester);
      expect(wordsOnTheirWay, findsNothing);

      await tester.fling(find.byType(PageView), const Offset(300, 0), 1200);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 700));
      expect(wordsOnTheirWay, findsWidgets, reason: 'the first page is not already finished on return');

      await tester.pump(arrival);
      expect(wordsOnTheirWay, findsNothing);
      expect(shownTitle(tester), titles.first);
    });
  });

  group('reduced motion', () {
    testWidgets('the page is simply there, nothing runs, and Next jumps', (tester) async {
      screen(tester);
      final text = await english();
      await tester.pumpWidget(app(reduceMotion: true));
      await tester.pump();

      // Finished on the first frame.
      expect(wordsOnTheirWay, findsNothing);
      expect(bodyOpacity(tester, text.introWelcomeBody), 1);
      // Nothing left running: both clocks of the page and the ground's.
      await tester.pumpAndSettle();

      await tester.tap(find.byType(FilledButton));
      await tester.pump();
      expect(shownTitle(tester), text.introReadTitle, reason: 'one frame, no travel');
      expect(find.byType(WelcomeScene), findsNothing);
      expect(find.byType(ReadScene), findsOneWidget);
      expect(wordsOnTheirWay, findsNothing);
      await tester.pumpAndSettle();

      for (var page = 2; page < IntroConfig.pageCount; page++) {
        await tester.tap(find.byType(FilledButton));
        await tester.pump();
      }
      expect(find.text(text.introStart), findsOneWidget);
      expect(find.text(text.introSkip).hitTestable(), findsNothing);
      await tester.pumpAndSettle();
    });
  });

  group('the pictures', () {
    for (final brightness in Brightness.values) {
      for (final picture in pictures.entries) {
        testWidgets('${picture.key} draws, builds up and loops without a seam (${brightness.name})', (tester) async {
          final easel = await Easel.set(tester, picture.value, brightness);

          final built = await easel.shot(enter: 1, loop: IntroConfig.stillLoop);
          final bare = await easel.shot(enter: 0, loop: IntroConfig.stillLoop);
          final start = await easel.shot(enter: 1, loop: 0);
          final end = await easel.shot(enter: 1, loop: 1);
          final half = await easel.shot(enter: 1, loop: 0.5);

          expect(inkOf(built), greaterThan(minInk * pixels), reason: 'something is drawn');
          expect(inkOf(built), greaterThan(inkOf(bare)), reason: 'the entrance adds to the picture');
          expect(differences(start, end), lessThan(seamTolerance * pixels), reason: 'end of the loop meets its start');
          expect(differences(start, half), greaterThan(moves * pixels), reason: 'the loop moves the picture');
          await easel.close();
        });
      }
    }

    testWidgets('the dark pictures keep to the dark palette: no hue (the colour rule)', (tester) async {
      // Welcome and Ask Sakha carry the feather and Sakha's own mark, which
      // have colours of their own; the other three are drawn from the theme.
      for (final name in ['read', 'chant', 'reels']) {
        final bright = await Easel.set(tester, pictures[name]!, Brightness.light);
        final warm = await bright.shot(enter: 1, loop: IntroConfig.stillLoop);
        await bright.close();
        expect(hueOf(warm), greaterThan(maxDarkHue), reason: '$name in the light theme shows no colour, so the measure is blind');

        final easel = await Easel.set(tester, pictures[name]!, Brightness.dark);
        final shot = await easel.shot(enter: 1, loop: IntroConfig.stillLoop);
        await easel.close();
        expect(inkOf(shot), greaterThan(minInk * pixels), reason: '$name draws nothing in the dark theme');
        expect(hueOf(shot), lessThanOrEqualTo(maxDarkHue), reason: '$name has a colour in the dark theme');
      }
    });

    testWidgets('the ground draws at any place the pager can be, in both themes', (tester) async {
      for (final brightness in Brightness.values) {
        final position = ValueNotifier<double>(0);
        final clock = AnimationController(vsync: tester, duration: const Duration(milliseconds: IntroConfig.moteMs));
        await tester.pumpWidget(
          app(
            brightness: brightness,
            home: Scaffold(body: IntroBackdrop(position: position, clock: clock)),
          ),
        );
        for (final at in [-0.4, 0.0, 1.5, 3.0, 4.0, 4.4]) {
          for (final time in [0.0, 0.5, 1.0]) {
            position.value = at;
            clock.value = time;
            await tester.pump();
            noErrors(tester, '${brightness.name}, page $at, clock $time');
          }
        }
        await tester.pumpWidget(const SizedBox());
        position.dispose();
        clock.dispose();
      }
    });

    testWidgets('the dots draw at any place the pager can be', (tester) async {
      final position = ValueNotifier<double>(0);
      await tester.pumpWidget(app(home: Scaffold(body: Center(child: IntroIndicator(position: position)))));

      for (final at in [-0.3, 0.0, 0.25, 0.5, 0.75, 3.5, 4.0, 4.3]) {
        position.value = at;
        await tester.pump();
        noErrors(tester, 'page $at');
      }
      await tester.pumpWidget(const SizedBox());
      position.dispose();
    });
  });

  group('on a small phone at the largest text, in every language', () {
    const small = Size(320, 568);

    for (final locale in AppLocalizations.supportedLocales) {
      testWidgets(locale.languageCode, (tester) async {
        screen(tester, small);
        final text = await AppLocalizations.delegate.load(locale);
        final titles = titlesOf(text);
        await open(tester, locale: locale, textScale: 2);

        for (var page = 0; page < IntroConfig.pageCount; page++) {
          expect(shownTitle(tester), titles[page], reason: 'page ${page + 1}');
          noErrors(tester, 'page ${page + 1}');

          final button = tester.getRect(find.byType(FilledButton));
          expect(button.left, greaterThanOrEqualTo(0), reason: 'button, page ${page + 1}');
          expect(button.right, lessThanOrEqualTo(small.width), reason: 'button, page ${page + 1}');
          expect(button.bottom, lessThanOrEqualTo(small.height), reason: 'button, page ${page + 1}');
          final dots = tester.getRect(find.byType(IntroIndicator));
          expect(dots.bottom, lessThanOrEqualTo(button.top), reason: 'dots above the button, page ${page + 1}');

          if (page < IntroConfig.pageCount - 1) await next(tester);
        }
      });
    }

    testWidgets('and lying on its side', (tester) async {
      screen(tester, const Size(568, 320));
      final titles = titlesOf(await english());
      await open(tester, textScale: 2);

      for (var page = 0; page < IntroConfig.pageCount; page++) {
        expect(shownTitle(tester), titles[page]);
        noErrors(tester, 'page ${page + 1}');
        if (page < IntroConfig.pageCount - 1) await next(tester);
      }
    });

    testWidgets('and on a tablet the picture and the words stop growing', (tester) async {
      screen(tester, const Size(1024, 768));
      await open(tester);

      expect(tester.getSize(find.byType(WelcomeScene)).width, lessThanOrEqualTo(IntroConfig.sceneMaxSide));
      expect(tester.getSize(find.byType(IntroTitle)).width, lessThanOrEqualTo(IntroConfig.textMaxWidth));
      expect(tester.getSize(find.byType(FilledButton)).width, lessThanOrEqualTo(IntroConfig.textMaxWidth));
      noErrors(tester);
    });
  });

  group('IntroConfig', () {
    test('a beat is 0 before its window, 1 after it, and runs through it in milliseconds', () {
      expect(IntroConfig.beat(0, 400, 900), 0);
      expect(IntroConfig.beat(1, 400, 900), 1);
      expect(IntroConfig.beat(400 / IntroConfig.enterMs, 400, 900), 0);
      expect(IntroConfig.beat(900 / IntroConfig.enterMs, 400, 900), 1);
      expect(IntroConfig.beat(650 / IntroConfig.enterMs, 400, 900, Curves.linear), closeTo(0.5, 1e-9));
    });

    test('a beat never goes backwards', () {
      var last = 0.0;
      for (var step = 0; step <= 200; step++) {
        final now = IntroConfig.beat(step / 200, 300, 1800);
        expect(now, greaterThanOrEqualTo(last));
        last = now;
      }
    });

    test('the title and the line under it are in before the entrance ends', () {
      expect(
        IntroConfig.titleFromMs + IntroConfig.titleSpanMs + IntroConfig.wordMs,
        lessThanOrEqualTo(IntroConfig.enterMs),
      );
      expect(IntroConfig.bodyFromMs, lessThan(IntroConfig.bodyToMs));
      expect(IntroConfig.bodyToMs, lessThanOrEqualTo(IntroConfig.enterMs));
    });

    test('the reading page turns and the reels swipe inside one turn of the loop, in order', () {
      expect(IntroConfig.flipFrom, lessThan(IntroConfig.flipTo));
      expect(IntroConfig.flipTo, lessThanOrEqualTo(1));
      expect(IntroConfig.swipeOneFrom + IntroConfig.swipeSpan, lessThanOrEqualTo(IntroConfig.swipeTwoFrom));
      expect(IntroConfig.swipeTwoFrom + IntroConfig.swipeSpan, lessThanOrEqualTo(1));
    });

    test('the still pose is a place on the loop', () {
      expect(IntroConfig.stillLoop, inInclusiveRange(0, 1));
    });

    test('a button label is gone by the half-way point of the swap, and the next one is in by the end', () {
      expect(IntroConfig.labelSwap.transform(0), 0);
      expect(IntroConfig.labelSwap.transform(0.5), 0);
      expect(IntroConfig.labelSwap.transform(1), 1);
      expect(IntroConfig.labelScale, inExclusiveRange(0, 1));
    });
  });
}

/// A picture on its own, its two clocks held by hand: set the entrance and the
/// loop to a moment, and take what is drawn there.
class Easel {
  Easel._(this._tester, this._enter, this._loop, this._key);

  final WidgetTester _tester;
  final AnimationController _enter;
  final AnimationController _loop;
  final GlobalKey _key;

  static Future<Easel> set(WidgetTester tester, SceneBuilder scene, Brightness brightness) async {
    final enter = AnimationController(vsync: tester, duration: IntroConfig.enter);
    final loop = AnimationController(vsync: tester, duration: IntroConfig.loop);
    final key = GlobalKey();
    await tester.pumpWidget(
      app(
        brightness: brightness,
        home: Scaffold(
          body: Center(
            child: RepaintBoundary(
              key: key,
              child: SizedBox.square(dimension: side, child: scene(enter, loop)),
            ),
          ),
        ),
      ),
    );
    // Some pictures carry an SVG, which is read and parsed asynchronously.
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
    await tester.pump();
    return Easel._(tester, enter, loop, key);
  }

  /// What is drawn with the entrance at [enter] and the loop at [loop], as
  /// RGBA bytes.
  Future<Uint8List> shot({required double enter, required double loop}) async {
    _enter.value = enter;
    _loop.value = loop;
    await _tester.pump();
    final boundary = _tester.renderObject<RenderRepaintBoundary>(find.byKey(_key));
    final image = (await _tester.runAsync(() => boundary.toImage()))!;
    final data = (await _tester.runAsync(() => image.toByteData(format: ui.ImageByteFormat.rawRgba)))!;
    expect(image.width * image.height, pixels, reason: 'the picture is $side across');
    return data.buffer.asUint8List();
  }

  Future<void> close() async {
    await _tester.pumpWidget(const SizedBox());
    _enter.dispose();
    _loop.dispose();
  }
}

/// How big a picture is drawn in these tests, and how many pixels that is.
const double side = 300;
final int pixels = (side * side).toInt();

/// The least a finished picture has to draw, the most a loop may jump where it
/// wraps, and the least it must change over half a turn — each as a share of
/// the picture.
const double minInk = 0.02;
const double seamTolerance = 0.0005;
const double moves = 0.001;

/// The widest spread between the red, green and blue of a pixel the dark
/// theme's pictures may have.
const int maxDarkHue = 24;

/// Pixels with some ink in them.
int inkOf(Uint8List rgba) {
  var count = 0;
  for (var i = 3; i < rgba.length; i += 4) {
    if (rgba[i] > 32) count++;
  }
  return count;
}

/// Pixels that differ between two shots by more than [tolerance] in some
/// channel.
int differences(Uint8List a, Uint8List b, {int tolerance = 8}) {
  var count = 0;
  for (var i = 0; i < a.length; i += 4) {
    for (var channel = 0; channel < 4; channel++) {
      if ((a[i + channel] - b[i + channel]).abs() > tolerance) {
        count++;
        break;
      }
    }
  }
  return count;
}

/// The widest spread between red, green and blue among the pixels of a shot
/// that are at least half there, with the premultiplication the bytes come in
/// undone: 0 is a grey.
int hueOf(Uint8List rgba) {
  var widest = 0;
  for (var i = 0; i < rgba.length; i += 4) {
    final alpha = rgba[i + 3];
    if (alpha < 128) continue;
    final r = rgba[i] * 255 ~/ alpha;
    final g = rgba[i + 1] * 255 ~/ alpha;
    final b = rgba[i + 2] * 255 ~/ alpha;
    final int spread = math.max<int>(r, math.max<int>(g, b)) - math.min<int>(r, math.min<int>(g, b));
    if (spread > widest) widest = spread;
  }
  return widest;
}
