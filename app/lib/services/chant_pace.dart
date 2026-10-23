import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/constants/auto_chant_config.dart';
import '../core/constants/storage_keys.dart';
import 'local_store.dart';

/// How long one chant of a mantra takes *this reader* — what auto count counts
/// by and what a hand tap is held to.
///
/// It starts as the mantra's standard time. The reader can change it a step at a
/// time, and a round they finish teaches it: the round was chanted from one
/// prayer tap to the next, so its real length over the round's chants is their
/// real pace. Both write the same one number, which is kept on the phone for the
/// mantra, and it is always held between [AutoChantConfig.fastestShare] and
/// [AutoChantConfig.slowestShare] of the standard time.
///
/// Pure functions here; the number itself is kept by [ChantPaceStore].
abstract final class ChantPace {
  /// [pace] held to the allowed range around [standard].
  static Duration clamp(Duration pace, Duration standard) {
    final fastest = standard * AutoChantConfig.fastestShare;
    final slowest = standard * AutoChantConfig.slowestShare;
    if (pace < fastest) return fastest;
    if (pace > slowest) return slowest;
    return pace;
  }

  /// How far one press of "shorter" or "longer" moves the pace.
  static Duration step(Duration standard) {
    final step = standard * AutoChantConfig.paceStepShare;
    const least = Duration(milliseconds: AutoChantConfig.minPaceStepMs);
    return step < least ? least : step;
  }

  /// [pace] one step longer or shorter, still inside the range.
  static Duration stepped(Duration pace, Duration standard, {required bool longer}) =>
      clamp(longer ? pace + step(standard) : pace - step(standard), standard);

  static bool canStep(Duration pace, Duration standard, {required bool longer}) =>
      stepped(pace, standard, longer: longer) != pace;

  /// The pace a finished round shows, or null when it shows nothing.
  ///
  /// [roundTime] runs from the tap that began the round to the tap that ended the
  /// prayer after it, so it holds the prayer too: [prayer], its standard time, is
  /// taken off. (Left in, every round would teach a pace a little slower than
  /// the last, even for someone chanting in step with the count.)
  static Duration? ofRound({
    required Duration roundTime,
    required Duration prayer,
    required int chants,
    required Duration standard,
  }) {
    final chanting = roundTime - prayer;
    if (chants <= 0 || chanting <= Duration.zero) return null;
    return clamp(chanting ~/ chants, standard);
  }
}

/// The pace each mantra is chanted at, kept on the phone: one number of
/// milliseconds per mantra, the same way [ChantProgressStore] keeps its beads.
/// A store that is not open (a test) or fails is not an error — the pace is then
/// the standard time.
abstract final class ChantPaceStore {
  static Map<String, int>? _memory;

  /// Stands in for the store in a widget test (see `ChantProgressStore`).
  @visibleForTesting
  static void keepInMemory() => _memory = {};

  @visibleForTesting
  static void keepInStore() => _memory = null;

  /// The pace kept for [mantraId], held to the range around [standard]; the
  /// standard time itself when none is kept.
  static Duration read(String mantraId, Duration standard) {
    final key = BoxKeys.chantPace(mantraId);
    int? kept;
    final memory = _memory;
    if (memory != null) {
      kept = memory[key];
    } else {
      try {
        kept = LocalStore.instance.read<int>(key);
      } catch (_) {
        kept = null;
      }
    }
    if (kept == null || kept <= 0) return standard;
    return ChantPace.clamp(Duration(milliseconds: kept), standard);
  }

  static void write(String mantraId, Duration pace) {
    final key = BoxKeys.chantPace(mantraId);
    final memory = _memory;
    if (memory != null) {
      memory[key] = pace.inMilliseconds;
      return;
    }
    try {
      unawaited(LocalStore.instance.write(key, pace.inMilliseconds).catchError((_) {}));
    } catch (_) {
      // Not remembering is better than failing a change of pace.
    }
  }
}
