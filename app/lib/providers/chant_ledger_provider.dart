import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/chant_sitting.dart';
import '../models/chant_tally.dart';
import '../services/chant_ledger_store.dart';
import 'sadhana_provider.dart';
import 'session_provider.dart';

/// Every sitting counted on this phone that is still worth keeping: the ones the
/// server has not been told about, and those it has for the last few days.
///
/// **This is where chanting is written first.** The counter puts what it counts
/// here on every bead, the phone keeps it (`ChantLedgerStore`), and `ChantSyncer`
/// sends it to the server in a batch later — so nothing waits on the network and
/// nothing is lost to it. Screens that show the day lay what is here over the
/// server's figures ([chantExtraProvider]) because the server's copy can be
/// behind.
///
/// It belongs to the signed-in account: another account signing in sees none of
/// it, and starts a ledger of its own (what the first one had not yet sent is
/// dropped, the way the routine's is).
class ChantLedger extends Notifier<List<ChantSitting>> {
  String? _owner;

  @override
  List<ChantSitting> build() {
    _owner = ref.watch(currentUserProvider.select((user) => user?.id));
    final owner = _owner;
    return owner == null ? const [] : ChantLedgerStore.read(owner);
  }

  /// Changes the sitting [clientId]: [change] is given what is held (null when
  /// nothing is) and answers what to hold now, or null to leave things as they
  /// are. The sittings that are not worth keeping any longer go with the write.
  void update(String clientId, ChantSitting? Function(ChantSitting? current) change) {
    final owner = _owner;
    if (owner == null || !ref.mounted) return;

    final index = state.indexWhere((sitting) => sitting.clientId == clientId);
    final next = change(index < 0 ? null : state[index]);
    if (next == null) return;

    final updated = [...state];
    if (index < 0) {
      updated.add(next);
    } else {
      updated[index] = next;
    }

    final kept = keptSittings(updated, DateTime.now());
    ChantLedgerStore.write(owner, kept);
    state = kept;
  }
}

final chantLedgerProvider = NotifierProvider<ChantLedger, List<ChantSitting>>(ChantLedger.new);

/// The rounds counted on this phone today that the server's figures for the day
/// do not hold yet — to be added to what [sadhanaTodayProvider] says. Zero when
/// the server's day has not loaded (there is nothing to add them to), and zero
/// once the server has heard everything.
final chantExtraProvider = Provider<int>((ref) {
  final today = ref.watch(sadhanaTodayProvider).value;
  if (today == null) return 0;

  return unsentRounds(
    sittings: ref.watch(chantLedgerProvider),
    day: today.date,
    sessions: today.sessions,
  );
});
