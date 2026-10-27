import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/chant_syncer.dart';
import '../services/sadhana_service.dart';
import 'chant_ledger_provider.dart';
import 'sadhana_provider.dart';
import 'session_provider.dart';
import 'sync_triggers.dart';

/// The chanting kept on the phone, sent to the account in batches.
///
/// Read once at boot (see `HariHariBolApp`) so it starts as soon as someone is
/// signed in, and read by the counter to ask for a batch after a bead. While
/// signed in it also sends when the app opens, comes back to the front, goes to
/// the back (so what was chanted a moment ago is not stranded) and when the
/// connection returns — which is how chanting done offline reaches the account,
/// however long after.
///
/// A send started by one of those moments, if the server took something, then
/// fetches the Jap tab's day again, so the screen holds the server's own figures.
/// The syncer's timer sends do not: a person counting is looking at the phone's
/// figures, which are ahead of the server's.
final chantSyncerProvider = Provider<ChantSyncer>((ref) {
  final syncer = ChantSyncer(
    send: SadhanaService.instance.syncChant,
    read: () => ref.mounted ? ref.read(chantLedgerProvider) : const [],
    update: (clientId, change) {
      if (ref.mounted) ref.read(chantLedgerProvider.notifier).update(clientId, change);
    },
    userId: () => ref.mounted ? ref.read(currentUserProvider)?.id : null,
  );

  Future<void> syncAndRefresh() async {
    final sent = await syncer.syncNow();
    // Only a day that was ever asked for is brought up to date: nothing is
    // fetched here for a screen nobody has opened.
    if (!sent || !ref.mounted || !ref.exists(sadhanaTodayProvider)) return;
    await ref.read(sadhanaTodayProvider.notifier).refresh();
  }

  final triggers = SyncTriggers(() => unawaited(syncAndRefresh()));

  // Only while signed in: nothing is listened to, and no timer is set, for a
  // phone that has nobody to send for.
  ref.listen<String?>(currentUserProvider.select((user) => user?.id), (previous, id) {
    if (id == null) {
      triggers.stop();
    } else {
      triggers.start();
      // After the first frame's providers have settled, not in the middle of them.
      scheduleMicrotask(() => unawaited(syncAndRefresh()));
    }
  }, fireImmediately: true);

  ref.onDispose(() {
    triggers.stop();
    syncer.dispose();
  });
  return syncer;
});
