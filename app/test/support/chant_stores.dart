import 'package:hariharibol/services/chant_ledger_store.dart';
import 'package:hariharibol/services/chant_pace.dart';
import 'package:hariharibol/services/chant_progress_store.dart';

/// A widget test of the chant counter must not write the real store: a write
/// started under the test's fake clock never finishes and hangs the next test's
/// `setUp` (see `ChantProgressStore`). The beads of the round, the pace a
/// finished round teaches and the ledger of sittings waiting for the server are
/// all written that way, so all three are kept aside.
void keepStoresInMemory() {
  ChantProgressStore.keepInMemory();
  ChantPaceStore.keepInMemory();
  ChantLedgerStore.keepInMemory();
}

void keepStoresInStore() {
  ChantProgressStore.keepInStore();
  ChantPaceStore.keepInStore();
  ChantLedgerStore.keepInStore();
}
