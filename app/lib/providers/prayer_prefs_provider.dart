import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/storage_keys.dart';
import '../services/local_store.dart';

/// The script the reader last picked for prayers: `original`, or a language
/// code. Null until they pick one — a prayer then opens in the first script of
/// their reading languages it offers (`resolvePrayerScript`). One answer for
/// every prayer, stored on the device like the font size: it says how this
/// person reads, and a prayer that does not offer it falls back for that
/// prayer only, without forgetting the pick.
class PrayerScriptNotifier extends Notifier<String?> {
  @override
  String? build() => LocalStore.instance.read<String>(BoxKeys.prayerScript);

  Future<void> set(String code) async {
    state = code;
    await LocalStore.instance.write(BoxKeys.prayerScript, code);
  }
}

final prayerScriptProvider = NotifierProvider<PrayerScriptNotifier, String?>(PrayerScriptNotifier.new);

/// Whether a prayer's verses open with their meaning showing. Closed until
/// somebody opens them all, and from then on open — stored on the device. A
/// single verse opened or closed by hand does not change it.
class PrayerMeaningsOpenNotifier extends Notifier<bool> {
  @override
  bool build() => LocalStore.instance.read<bool>(BoxKeys.prayerMeaningsOpen) ?? false;

  Future<void> set(bool open) async {
    state = open;
    await LocalStore.instance.write(BoxKeys.prayerMeaningsOpen, open);
  }
}

final prayerMeaningsOpenProvider =
    NotifierProvider<PrayerMeaningsOpenNotifier, bool>(PrayerMeaningsOpenNotifier.new);

/// Whether the original is shown above a verse written in another script, so
/// someone learning to read it can see both. Off until switched on; stored on
/// the device.
class PrayerShowOriginalNotifier extends Notifier<bool> {
  @override
  bool build() => LocalStore.instance.read<bool>(BoxKeys.prayerShowOriginal) ?? false;

  Future<void> set(bool show) async {
    state = show;
    await LocalStore.instance.write(BoxKeys.prayerShowOriginal, show);
  }
}

final prayerShowOriginalProvider =
    NotifierProvider<PrayerShowOriginalNotifier, bool>(PrayerShowOriginalNotifier.new);
