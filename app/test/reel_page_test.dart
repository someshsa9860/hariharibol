// What one reel draws over its media, and — more importantly — what it does
// not draw.
//
// The reel surface is the one place in the app where state cannot be said with
// colour: it sits over footage nobody has seen, in both themes, so a filled
// icon is the whole signal. These tests hold that line, and the related one
// from the design rules: no control that does nothing. A mute button on a
// silent slideshow and a follow button on your own reel are both controls that
// cannot work, so neither is drawn.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_colors.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/reel.dart';
import 'package:hariharibol/widgets/reels/reel_overlays.dart';
import 'package:hariharibol/widgets/reels/reel_page.dart';

Reel reel({
  String mediaType = 'IMAGE',
  String? videoUrl,
  String? audioUrl,
  String caption = 'Hare Krishna',
  int likeCount = 0,
  int commentCount = 0,
  int shareCount = 0,
  bool isLiked = false,
  bool isSaved = false,
  bool isFollowingCreator = false,
  bool isMine = false,
  Map<String, dynamic>? verse,
  Map<String, dynamic>? mantra,
  List<String> tags = const [],
  List<Map<String, dynamic>> overlays = const [],
}) =>
    Reel.fromJson({
      'id': 'r1',
      'mediaType': mediaType,
      'videoUrl': videoUrl,
      'audioUrl': audioUrl,
      'caption': caption,
      'likeCount': likeCount,
      'commentCount': commentCount,
      'shareCount': shareCount,
      'isLiked': isLiked,
      'isSaved': isSaved,
      'isFollowingCreator': isFollowingCreator,
      'isMine': isMine,
      'verse': verse,
      'mantra': mantra,
      'tags': tags,
      'overlays': overlays,
      'creator': {'id': 'c1', 'displayName': 'Gopal Das', 'isVerified': true},
    });

Future<void> pumpReel(WidgetTester tester, Reel subject, {ThemeData? theme, VoidCallback? onSimilarTap}) {
  return tester.pumpWidget(
    MaterialApp(
      theme: theme ?? AppTheme.light,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: ReelPage(
        reel: subject,
        isActive: false,
        isMuted: true,
        onLike: () {},
        onComment: () {},
        onShare: () {},
        onSave: () {},
        onMore: () {},
        onFollow: () {},
        onCreatorTap: () {},
        onToggleMute: () {},
        onSimilarTap: onSimilarTap,
      ),
    ),
  );
}

void main() {
  testWidgets('draws the creator, the caption and the actions', (tester) async {
    await pumpReel(tester, reel(likeCount: 12, commentCount: 3));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.text('Gopal Das'), findsOneWidget);
    expect(find.text('Hare Krishna'), findsOneWidget);
    expect(find.byIcon(Icons.verified_rounded), findsOneWidget);

    // Counts are abbreviated but present.
    expect(find.text('12'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('says liked and saved with a filled icon, not a colour', (tester) async {
    await pumpReel(tester, reel());
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.favorite_border_rounded), findsOneWidget);
    expect(find.byIcon(Icons.favorite_rounded), findsNothing);
    expect(find.byIcon(Icons.bookmark_border_rounded), findsOneWidget);

    await pumpReel(tester, reel(isLiked: true, isSaved: true));
    // Settled, not pumped once: the fill/outline swap runs through an
    // AnimatedSwitcher, so mid-transition both icons are legitimately in the
    // tree. Waiting it out is what asserts the state that is left behind.
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);
    expect(find.byIcon(Icons.favorite_border_rounded), findsNothing);
    expect(find.byIcon(Icons.bookmark_rounded), findsOneWidget);
  });

  testWidgets('renders the same over both themes', (tester) async {
    // The reel surface is black-and-white in both, so nothing here may depend
    // on which ColorScheme is in play.
    for (final theme in [AppTheme.light, AppTheme.dark]) {
      await pumpReel(tester, reel(isLiked: true), theme: theme);
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.text('Gopal Das'), findsOneWidget);
      expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);
    }
  });

  testWidgets('offers no mute button on a silent slideshow', (tester) async {
    await pumpReel(tester, reel());
    await tester.pump();
    // Nothing to turn off — see "no control that does nothing".
    expect(find.byIcon(Icons.volume_off_rounded), findsNothing);
    expect(find.byIcon(Icons.volume_up_rounded), findsNothing);
  });

  testWidgets('offers one on a slideshow with a background track', (tester) async {
    await pumpReel(tester, reel(audioUrl: 'https://example.invalid/track.mp3'));
    await tester.pump();
    expect(find.byIcon(Icons.volume_off_rounded), findsOneWidget);
  });

  testWidgets('renders an AUDIO reel over its cover instead of falling through to video',
      (tester) async {
    // Before AUDIO was a recognised media type this parsed as `video` with no
    // videoUrl, which the video player has no fallback for — a blank, silent
    // reel. This is the regression that behaviour would reintroduce.
    await pumpReel(
      tester,
      reel(mediaType: 'AUDIO', audioUrl: 'https://example.invalid/verse-2-65.mp3'),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.text('Gopal Das'), findsOneWidget);
    expect(find.byIcon(Icons.volume_off_rounded), findsOneWidget);
  });

  testWidgets('offers no follow button on your own reel', (tester) async {
    await pumpReel(tester, reel(isMine: true));
    await tester.pump();
    // The API refuses following yourself, so the control is not drawn.
    expect(find.text('Follow'), findsNothing);
    expect(find.text('Following'), findsNothing);
  });

  testWidgets('shows follow state as a word and a tick', (tester) async {
    await pumpReel(tester, reel());
    await tester.pump();
    expect(find.text('Follow'), findsOneWidget);
    expect(find.byIcon(Icons.check_rounded), findsNothing);

    await pumpReel(tester, reel(isFollowingCreator: true));
    await tester.pumpAndSettle();
    expect(find.text('Following'), findsOneWidget);
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
  });

  testWidgets('labels a linked verse through l10n, not a baked string',
      (tester) async {
    await pumpReel(
      tester,
      reel(verse: {
        'id': 'v1',
        'verseId': '1.2.47',
        'bookNumber': 1,
        'chapterNumber': 2,
        'verseNumber': 47,
      }),
    );
    await tester.pump();
    expect(find.text('BG 2.47'), findsOneWidget);
  });

  testWidgets('uses the Bhagavatam abbreviation for book two', (tester) async {
    await pumpReel(
      tester,
      reel(verse: {
        'id': 'v2',
        'verseId': '2.1.1.10',
        'bookNumber': 2,
        'chapterNumber': 1,
        'verseNumber': 10,
      }),
    );
    await tester.pump();
    expect(find.text('SB 1.10'), findsOneWidget);
  });

  testWidgets('cites a verse from any book by the name the API gives it', (tester) async {
    // bookNumber alone only ever told Gita from Bhagavatam, so a third book
    // used to be called "SB".
    await pumpReel(
      tester,
      reel(verse: {
        'id': 'v',
        'verseId': '7.2.3',
        'bookNumber': 7,
        'chapterNumber': 2,
        'verseNumber': 3,
        'label': 'Chaitanya Charitamrita 2.3',
      }),
    );
    await tester.pump();

    expect(find.text('Chaitanya Charitamrita 2.3'), findsOneWidget);
    expect(find.text('SB 2.3'), findsNothing);
  });

  testWidgets('offers more like this only when it is given somewhere to go', (tester) async {
    await pumpReel(tester, reel(tags: const ['chapter:bhagavad-gita-2']));
    await tester.pump();
    expect(find.text('More like this'), findsNothing);

    var opened = 0;
    await pumpReel(tester, reel(tags: const ['chapter:bhagavad-gita-2']), onSimilarTap: () => opened++);
    await tester.pump();
    expect(find.text('More like this'), findsOneWidget);

    await tester.tap(find.text('More like this'));
    expect(opened, 1);
  });

  testWidgets('names a linked mantra', (tester) async {
    await pumpReel(
      tester,
      reel(mantra: {'id': 'm1', 'slug': 'hare-krishna', 'name': 'Hare Krishna Mahamantra'}),
    );
    await tester.pump();
    expect(find.text('Hare Krishna Mahamantra'), findsOneWidget);
  });

  testWidgets('a reel with no caption and nothing linked still renders',
      (tester) async {
    await pumpReel(tester, reel(caption: ''));
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.text('Gopal Das'), findsOneWidget);
  });

  group('text laid over the reel', () {
    // The test surface is 800 x 600 logical pixels, and the page fills it.
    const frameWidth = 800.0;
    const frameHeight = 600.0;

    Map<String, dynamic> box(String text, {Map<String, dynamic> extra = const {}}) => {
          'id': text,
          'text': text,
          'x': 10,
          'y': 25,
          'width': 50,
          'size': 5,
          ...extra,
        };

    testWidgets('lands where the editor put it, sized as a share of the width', (tester) async {
      await pumpReel(tester, reel(overlays: [box('Karmanye vadhikaraste')]));
      await tester.pump();

      final finder = find.text('Karmanye vadhikaraste');
      expect(finder, findsOneWidget);

      final topLeft = tester.getTopLeft(finder);
      expect(topLeft.dx, closeTo(frameWidth * 0.10, 0.01));
      expect(topLeft.dy, closeTo(frameHeight * 0.25, 0.01));
      expect(tester.getSize(finder).width, closeTo(frameWidth * 0.50, 0.01));

      final style = tester.widget<Text>(finder).style!;
      expect(style.fontSize, closeTo(frameWidth * 0.05, 0.01));
    });

    testWidgets('does not scale with the system text size', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await pumpReel(tester, reel(overlays: [box('Govinda Hari')]));
      await tester.pump();

      // Doubling the type would push this line into the one below it; the box
      // is placed by percentage, so its type is too.
      expect(tester.widget<Text>(find.text('Govinda Hari')).textScaler, TextScaler.noScaling);
    });

    testWidgets('draws every box, in the colour and alignment it was given', (tester) async {
      await pumpReel(
        tester,
        reel(overlays: [
          box('First', extra: {'color': 'accent', 'align': 'right'}),
          box('Second', extra: {'y': 60, 'style': 'heading', 'color': 'dark'}),
        ]),
      );
      await tester.pump();

      final first = tester.widget<Text>(find.text('First'));
      expect(first.textAlign, TextAlign.right);
      expect(first.style!.color, AppColors.reelOverlayAccent);

      final second = tester.widget<Text>(find.text('Second'));
      expect(second.style!.color, AppColors.reelOverlayDark);
      // Dark text gets a light glow, not the dark shadow light text gets.
      expect(second.style!.shadows!.single.color, AppColors.reelTextGlow);
      expect(first.style!.shadows!.single.color, AppColors.reelTextShadow);
    });

    testWidgets('does not take taps away from the player underneath', (tester) async {
      await pumpReel(tester, reel(overlays: [box('Govinda Hari')]));
      await tester.pump();

      final ignoring = find.ancestor(
        of: find.text('Govinda Hari'),
        matching: find.byType(IgnorePointer),
      );
      expect(ignoring, findsWidgets);
    });

    testWidgets('draws nothing extra for a reel without any', (tester) async {
      await pumpReel(tester, reel());
      await tester.pump();
      expect(find.byType(ReelOverlays), findsOneWidget);
      expect(find.descendant(of: find.byType(ReelOverlays), matching: find.byType(Text)), findsNothing);
    });

    testWidgets('renders the same over both themes', (tester) async {
      for (final theme in [AppTheme.light, AppTheme.dark]) {
        await pumpReel(tester, reel(overlays: [box('Om Namo Narayanaya', extra: {'style': 'verse'})]), theme: theme);
        await tester.pump();
        expect(tester.takeException(), isNull);
        expect(find.text('Om Namo Narayanaya'), findsOneWidget);
      }
    });
  });
}
