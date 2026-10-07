// The player behind the "Chant along" card, against a fake just_audio player:
// that it opens the recording (or says it could not), that every chant that ends
// is counted once as it plays, and that what a seek skips is not counted. The
// arithmetic of where a chant falls is in chant_mala_timing_test.dart; this is
// the glue — links, streams, the end of the recording, the screen being held on.

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/services/chant_mala_player.dart';
import 'package:hariharibol/services/chant_mala_timing.dart';

import 'fake_audio_player.dart';

const String link = 'https://media.test/mala.mp3?signature=old';
const String freshLink = 'https://media.test/mala.mp3?signature=fresh';

/// A ten second prayer, then ten chants of four seconds, on a one minute
/// recording.
final ChantMalaTiming afterAPrayer = ChantMalaTiming(
  start: const Duration(seconds: 10),
  end: const Duration(seconds: 50),
  chants: 10,
);

/// Ten chants of six seconds that run to the very end of the recording.
final ChantMalaTiming wholeRecording = ChantMalaTiming(
  start: Duration.zero,
  end: const Duration(minutes: 1),
  chants: 10,
);

const Duration reading = FakeAudioPlayer.tick;

/// The player under test, the fake beneath it, and every count it reported.
class Rig {
  Rig({ChantMalaTiming? timing, Future<String?> Function()? refreshUrl})
    : fake = FakeAudioPlayer(length: const Duration(minutes: 1)) {
    player = ChantMalaPlayer(
      url: link,
      timing: timing ?? afterAPrayer,
      refreshUrl: refreshUrl,
      player: fake,
    );
    subscription = player.chantsCompleted.listen(counts.add);
  }

  final FakeAudioPlayer fake;
  late final ChantMalaPlayer player;
  late final StreamSubscription<int> subscription;

  /// Each batch of chants that finished, as the counter hears them.
  final List<int> counts = [];

  int get total => counts.fold(0, (sum, batch) => sum + batch);

  ChantMalaPhase get phase => player.state.value.phase;

  /// Plays on to [to] and lets what it reported reach the listeners.
  Future<void> playTo(Duration to) async {
    fake.playTo(to);
    await pumpEventQueue();
  }

  /// Plays the whole recording out, a reading at a time, to its last moment.
  Future<void> playThrough({bool reportEnd = true}) async {
    fake.playTo(fake.length - reading);
    fake.finish(reportEnd: reportEnd);
    await pumpEventQueue();
  }

  Future<void> close() async {
    await subscription.cancel();
    await player.dispose();
  }
}

/// A rig with the recording open, and playing if [playing].
Future<Rig> opened({
  ChantMalaTiming? timing,
  Future<String?> Function()? refreshUrl,
  bool playing = true,
}) async {
  final rig = Rig(timing: timing, refreshUrl: refreshUrl);
  addTearDown(rig.close);
  await rig.player.load();
  if (playing) {
    await rig.player.play();
    await pumpEventQueue();
  }
  return rig;
}

void main() {
  late FakeWakelock wakelock;

  setUp(() => wakelock = installFakeWakelock());

  group('opening the recording', () {
    test('is ready, at the length the player reports, once the link opens', () async {
      final rig = Rig();
      addTearDown(rig.close);
      expect(rig.phase, ChantMalaPhase.loading);

      await rig.player.load();

      expect(rig.fake.opened, [link]);
      expect(rig.phase, ChantMalaPhase.ready);
      expect(rig.player.state.value.duration, const Duration(minutes: 1));
    });

    test('says so when the link will not open, and opens it on another try', () async {
      final rig = Rig()..fake.brokenUrls.add(link);
      addTearDown(rig.close);

      await rig.player.load();
      expect(rig.phase, ChantMalaPhase.failed);

      rig.fake.brokenUrls.clear();
      await rig.player.load();
      expect(rig.phase, ChantMalaPhase.ready);
    });

    test('asks once for a fresh link when the one it was given has expired', () async {
      final rig = Rig(refreshUrl: () async => freshLink)..fake.brokenUrls.add(link);
      addTearDown(rig.close);

      await rig.player.load();

      expect(rig.fake.opened, [link, freshLink]);
      expect(rig.phase, ChantMalaPhase.ready);
    });

    test('does not go round again when the fresh link is the same one', () async {
      var asked = 0;
      final rig = Rig(
        refreshUrl: () async {
          asked += 1;
          return link;
        },
      )..fake.brokenUrls.add(link);
      addTearDown(rig.close);

      await rig.player.load();

      expect(asked, 1);
      expect(rig.fake.opened, [link]);
      expect(rig.phase, ChantMalaPhase.failed);
    });

    test('fails when there is no fresh link to be had', () async {
      for (final refresh in <Future<String?> Function()>[
        () async => null,
        () async => '',
        () async => throw StateError('offline'),
      ]) {
        final rig = Rig(refreshUrl: refresh)..fake.brokenUrls.add(link);
        addTearDown(rig.close);

        await rig.player.load();

        expect(rig.fake.opened, [link]);
        expect(rig.phase, ChantMalaPhase.failed);
      }
    });

    test('will not play until it is open', () async {
      final rig = Rig();
      addTearDown(rig.close);
      await rig.player.play();
      expect(rig.fake.plays, 0);

      rig.fake.brokenUrls.add(link);
      await rig.player.load();
      await rig.player.play();
      expect(rig.fake.plays, 0);
    });
  });

  group('counting along', () {
    test('counts each chant as it ends, and none before', () async {
      final rig = await opened();

      await rig.playTo(const Duration(seconds: 13, milliseconds: 900));
      expect(rig.counts, isEmpty);

      await rig.playTo(const Duration(seconds: 14));
      expect(rig.counts, [1]);

      await rig.playTo(const Duration(seconds: 22));
      expect(rig.counts, [1, 1, 1]);
    });

    test('counts a whole recording once, and no more', () async {
      final rig = await opened();
      await rig.playThrough();
      expect(rig.total, 10);
    });

    test('counts a last chant that the final reading stopped short of', () async {
      final rig = await opened(timing: wholeRecording);

      rig.fake.playTo(rig.fake.length - reading);
      await pumpEventQueue();
      expect(rig.total, 9);

      // The recording completes without a reading of its very end.
      rig.fake.finish(reportEnd: false);
      await pumpEventQueue();
      expect(rig.total, 10);
    });

    test('is paused when the recording ends', () async {
      final rig = await opened();
      await rig.playThrough();

      expect(rig.player.isPlaying, isFalse);
      expect(rig.fake.pauses, 1);
    });

    test('plays from the top again from the end, and counts that time too', () async {
      final rig = await opened();
      await rig.playThrough();
      expect(rig.total, 10);

      await rig.player.play();
      await pumpEventQueue();
      expect(rig.fake.seeks.last, Duration.zero);
      expect(rig.player.isPlaying, isTrue);

      await rig.playTo(const Duration(seconds: 14));
      expect(rig.total, 11);
    });

    test('a seek counts nothing for what it skips, then counts on from there', () async {
      final rig = await opened();
      await rig.playTo(const Duration(seconds: 14));
      expect(rig.total, 1);

      // Five chants have ended by 30 s; none of them is counted by jumping there.
      await rig.player.seek(const Duration(seconds: 30));
      await pumpEventQueue();
      expect(rig.total, 1);
      expect(rig.player.state.value.position, const Duration(seconds: 30));

      await rig.playTo(const Duration(seconds: 34));
      expect(rig.total, 2);
    });

    test('a seek back counts nothing, and hearing it again counts it again', () async {
      final rig = await opened();
      await rig.playTo(const Duration(seconds: 26));
      expect(rig.total, 4);

      await rig.player.seek(const Duration(seconds: 6));
      await pumpEventQueue();
      expect(rig.total, 4);

      await rig.playTo(const Duration(seconds: 18));
      expect(rig.total, 6);
    });

    test('a reading from before a seek finished neither counts nor moves the bar', () async {
      final rig = await opened();
      await rig.playTo(const Duration(seconds: 14));

      final gate = rig.fake.seekGate = Completer<void>();
      final seeking = rig.player.seek(const Duration(seconds: 6));
      rig.fake.reportStale(const Duration(seconds: 40));
      await pumpEventQueue();

      expect(rig.total, 1);
      expect(rig.player.state.value.position, const Duration(seconds: 6));

      gate.complete();
      await seeking;
      await rig.playTo(const Duration(seconds: 14));
      expect(rig.total, 2);
    });

    test('follows the position and the length for the bar', () async {
      final rig = await opened();
      await rig.playTo(const Duration(seconds: 3));

      expect(rig.player.state.value.position, const Duration(seconds: 3));
      expect(rig.player.state.value.duration, const Duration(minutes: 1));
    });
  });

  group('play and pause', () {
    test('toggle starts and stops it', () async {
      final rig = await opened(playing: false);
      expect(rig.player.isPlaying, isFalse);

      await rig.player.toggle();
      await pumpEventQueue();
      expect(rig.player.isPlaying, isTrue);

      await rig.player.toggle();
      await pumpEventQueue();
      expect(rig.player.isPlaying, isFalse);
    });
  });

  group('the screen', () {
    test('is held on while the recording plays and let go when it stops', () async {
      final rig = await opened(playing: false);
      expect(wakelock.toggles, isEmpty);

      await rig.player.play();
      await pumpEventQueue();
      expect(wakelock.held, isTrue);

      await rig.player.pause();
      await pumpEventQueue();
      expect(wakelock.held, isFalse);
    });

    test('is let go when the recording ends, and when the card is closed', () async {
      final rig = await opened();
      expect(wakelock.held, isTrue);

      await rig.playThrough();
      expect(wakelock.held, isFalse);

      await rig.player.play();
      await pumpEventQueue();
      expect(wakelock.held, isTrue);

      await rig.player.dispose();
      await pumpEventQueue();
      expect(wakelock.held, isFalse);
    });

    test('a device that will not hold it awake still plays and counts', () async {
      wakelock.failing = true;
      final rig = await opened();

      await rig.playTo(const Duration(seconds: 14));

      expect(rig.player.isPlaying, isTrue);
      expect(rig.total, 1);
    });
  });

  group('closing it', () {
    test('releases the player and counts no more', () async {
      final rig = await opened();
      await rig.playTo(const Duration(seconds: 14));
      expect(rig.total, 1);

      await rig.player.dispose();
      expect(rig.fake.disposed, isTrue);

      await rig.playTo(const Duration(seconds: 22));
      expect(rig.total, 1);
    });

    test('twice is harmless', () async {
      final rig = await opened();
      await rig.player.dispose();
      await rig.player.dispose();
    });
  });
}
