// The reels feed as the third tab: it has no close button, names itself, and
// plays only while it is the tab on screen.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/reel.dart';
import 'package:hariharibol/providers/reel_provider.dart';
import 'package:hariharibol/views/reels/reels_view.dart';
import 'package:hariharibol/widgets/reels/reel_page.dart';

class _FakeFeed extends ReelFeedNotifier {
  @override
  Future<List<Reel>> build() async => [
        Reel.fromJson({
          'id': 'r1',
          'mediaType': 'IMAGE',
          'caption': 'Hare Krishna',
          'creator': {'id': 'c1', 'displayName': 'Gopal Das'},
        }),
      ];
}

Widget _app({required bool shown}) => ProviderScope(
      overrides: [reelFeedProvider.overrideWith(_FakeFeed.new)],
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        // What the shell does to a branch that is not on screen.
        home: TickerMode(enabled: shown, child: const ReelsView()),
      ),
    );

bool _playing(WidgetTester tester) =>
    tester.widget<ReelPage>(find.byType(ReelPage, skipOffstage: false)).isActive;

void main() {
  testWidgets('names itself and has nothing to close', (tester) async {
    await tester.pumpWidget(_app(shown: true));
    await tester.pump();
    await tester.pump();

    expect(find.text('Reels'), findsOneWidget);
    expect(find.byIcon(Icons.close_rounded), findsNothing);
  });

  testWidgets('plays while it is the tab on screen', (tester) async {
    await tester.pumpWidget(_app(shown: true));
    await tester.pump();
    await tester.pump();

    expect(_playing(tester), isTrue);
  });

  testWidgets('stops when another tab is open, and resumes when it returns', (tester) async {
    await tester.pumpWidget(_app(shown: true));
    await tester.pump();
    await tester.pump();
    expect(_playing(tester), isTrue);

    await tester.pumpWidget(_app(shown: false));
    await tester.pump();
    expect(_playing(tester), isFalse);

    await tester.pumpWidget(_app(shown: true));
    await tester.pump();
    expect(_playing(tester), isTrue);
  });

  // Ask Sakha opens over the bar, so the feed under it must stop on its own —
  // nothing in the shell tells it a screen was pushed.
  testWidgets('stops when a screen is opened over it, and resumes when that closes', (tester) async {
    await tester.pumpWidget(_app(shown: true));
    await tester.pump();
    await tester.pump();
    expect(_playing(tester), isTrue);

    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.push(MaterialPageRoute<void>(builder: (_) => const Scaffold(body: Text('chat'))));
    await tester.pumpAndSettle();
    expect(find.text('chat'), findsOneWidget);
    expect(_playing(tester), isFalse);

    navigator.pop();
    await tester.pumpAndSettle();
    expect(_playing(tester), isTrue);
  });
}
