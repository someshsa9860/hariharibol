import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/format/byte_size.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/tts_model.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/services/audio/interruption_policy.dart';
import 'package:hariharibol/services/audio/reading_item.dart';
import 'package:hariharibol/services/audio/reading_memory.dart';
import 'package:hariharibol/services/audio/reading_playback_controller.dart';
import 'package:hariharibol/widgets/library/verse_block.dart';
import 'package:hariharibol/widgets/settings/voice_tile.dart';

import 'reading_playback_test.dart' show FakeAudio, FakePlayer, FakeTts, item;

Widget app(Widget child) => MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: SingleChildScrollView(child: child)),
    );

VerseBlock block({VoidCallback? onPlay, bool? playing, ReadingSection? section}) => VerseBlock(
      verse: const Verse(id: 'v', verseId: '1.1.1', bookNumber: 1, type: 'S', verseNumber: 7, sanskrit: 'ॐ'),
      fontScale: 1,
      isFavorite: false,
      isHighlighted: false,
      noteCount: 0,
      onToggleFavorite: () {},
      onToggleHighlight: () {},
      onOpenNotes: () {},
      onOpenRelated: () {},
      onPlay: onPlay,
      playing: playing,
      playingSection: section,
    );

void main() {
  group('VerseBlock play button', () {
    testWidgets('is not drawn when there is nothing to play', (tester) async {
      await tester.pumpWidget(app(block()));
      expect(find.byTooltip('Play this verse'), findsNothing);
    });

    testWidgets('plays the verse when tapped', (tester) async {
      var taps = 0;
      await tester.pumpWidget(app(block(onPlay: () => taps++)));
      await tester.tap(find.byTooltip('Play this verse'));
      expect(taps, 1);
    });

    testWidgets('names the part being heard, in words', (tester) async {
      await tester.pumpWidget(app(block(onPlay: () {}, playing: true, section: ReadingSection.purport)));
      expect(find.text('Verse 7 · Purport'), findsOneWidget);
      expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);
    });

    testWidgets('a verse not being read shows only its number', (tester) async {
      await tester.pumpWidget(app(block(onPlay: () {}, playing: false)));
      expect(find.textContaining('Purport'), findsNothing);
      expect(find.byIcon(Icons.play_arrow_rounded), findsOneWidget);
    });
  });

  group('VoiceTile', () {
    const spec = TtsModelSpec(
      id: 'v',
      name: 'Hindi — Pratham',
      languages: ['hi'],
      engine: 'sherpa-vits',
      url: 'https://x',
      sizeBytes: 62000000,
      sha256: '',
      files: TtsModelFiles(model: 'm', tokens: 't'),
    );

    Future<void> pump(WidgetTester tester, TtsModelStatus status, {List<String>? calls}) {
      return tester.pumpWidget(app(VoiceTile(
        spec: spec,
        languages: 'हिन्दी',
        status: status,
        onDownload: () => calls?.add('download'),
        onCancel: () => calls?.add('cancel'),
        onDelete: () => calls?.add('delete'),
      )));
    }

    testWidgets('not installed: shows the size and offers download', (tester) async {
      final calls = <String>[];
      await pump(tester, const TtsNotInstalled(), calls: calls);
      expect(find.text('Not downloaded · 62 MB'), findsOneWidget);
      await tester.tap(find.byTooltip('Download'));
      expect(calls, ['download']);
    });

    testWidgets('downloading: shows the percentage and offers cancel', (tester) async {
      final calls = <String>[];
      await pump(tester, const TtsDownloading(received: 31, total: 62), calls: calls);
      expect(find.text('Downloading 50%'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      await tester.tap(find.byTooltip('Cancel'));
      expect(calls, ['cancel']);
    });

    testWidgets('installed: asks before deleting', (tester) async {
      final calls = <String>[];
      await pump(tester, const TtsInstalled(61000000), calls: calls);
      expect(find.text('Installed · 61 MB'), findsOneWidget);
      await tester.tap(find.byTooltip('Delete'));
      await tester.pumpAndSettle();
      expect(calls, isEmpty);
      await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
      await tester.pumpAndSettle();
      expect(calls, ['delete']);
    });

    testWidgets('failed: says so and offers to try again', (tester) async {
      await pump(tester, const TtsFailed('checksum mismatch'));
      expect(find.text('Could not install this voice'), findsOneWidget);
      expect(find.byTooltip('Try again'), findsOneWidget);
    });

    testWidgets('verifying and installing: no action, an indeterminate bar', (tester) async {
      await pump(tester, const TtsVerifying());
      expect(find.text('Checking…'), findsOneWidget);
      expect(find.byType(IconButton), findsNothing);
    });
  });

  test('formatBytes', () {
    expect(formatBytes(0), '0 B');
    expect(formatBytes(999), '999 B');
    expect(formatBytes(1500), '1.5 KB');
    expect(formatBytes(62000000), '62 MB');
    expect(formatBytes(365000000), '365 MB');
    expect(formatBytes(1400000000), '1.4 GB');
  });

  group('InterruptionPolicy', () {
    late FakeTts tts;
    late ReadingPlaybackController c;
    late InterruptionPolicy policy;

    setUp(() {
      final log = <String>[];
      tts = FakeTts(log)..hold = true;
      c = ReadingPlaybackController(player: FakePlayer(log), tts: tts, audio: FakeAudio(log), memory: InMemoryReadingMemory());
      c.load([item(1, audio: false)], context: 'c');
      policy = InterruptionPolicy(c);
    });

    Future<void> playing() async {
      c.playVerse(0);
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }

    tearDown(() => c.stop());

    test('a call pauses, and the end of the call resumes', () async {
      await playing();
      await policy.onInterruptionBegan();
      expect(c.state.status, ReadingStatus.paused);
      await policy.onInterruptionEnded(mayResume: true);
      expect(c.state.status, ReadingStatus.playing);
    });

    test('an interruption the system says not to resume from stays paused', () async {
      await playing();
      await policy.onInterruptionBegan();
      await policy.onInterruptionEnded(mayResume: false);
      expect(c.state.status, ReadingStatus.paused);
    });

    test('a reader who paused is not resumed behind their back', () async {
      await playing();
      await c.pause();
      await policy.onInterruptionBegan();
      await policy.onInterruptionEnded(mayResume: true);
      expect(c.state.status, ReadingStatus.paused);
    });

    test('headphones unplugged pauses and never resumes by itself', () async {
      await playing();
      await policy.onBecomingNoisy();
      expect(c.state.status, ReadingStatus.paused);
      await policy.onInterruptionEnded(mayResume: true);
      expect(c.state.status, ReadingStatus.paused);
    });

    test('an interruption when nothing is playing does nothing', () async {
      await policy.onInterruptionBegan();
      await policy.onInterruptionEnded(mayResume: true);
      expect(c.state.status, ReadingStatus.idle);
    });
  });
}
