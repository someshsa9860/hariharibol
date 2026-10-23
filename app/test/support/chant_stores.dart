import 'package:hariharibol/services/chant_pace.dart';
import 'package:hariharibol/services/chant_progress_store.dart';

/// A widget test of the chant counter must not write the real store: a write
/// started under the test's fake clock never finishes and hangs the next test's
/// `setUp` (see `ChantProgressStore`). The beads of the round and the pace a
/// finished round teaches are both written that way, so both are kept aside.
void keepStoresInMemory() {
  ChantProgressStore.keepInMemory();
  ChantPaceStore.keepInMemory();
}

void keepStoresInStore() {
  ChantProgressStore.keepInStore();
  ChantPaceStore.keepInStore();
}
