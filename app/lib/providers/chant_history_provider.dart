import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/chant_log.dart';
import '../models/paged.dart';
import '../services/sadhana_service.dart';

/// Past sittings of one mantra, newest first, loaded a page at a time. The key
/// is the mantra's id, or null for sittings that had none.
///
/// `autoDispose`: the history is only ever looked at from the counter's
/// analytics screen, and a list left cached would be stale by the next sitting.
class ChantHistoryNotifier extends AsyncNotifier<Paged<ChantSessionSummary>> {
  ChantHistoryNotifier(this._mantraId);

  final String? _mantraId;

  @override
  Future<Paged<ChantSessionSummary>> build() =>
      SadhanaService.instance.chantSessions(mantraId: _mantraId);

  bool _loadingMore = false;

  Future<void> loadMore() async {
    final current = state.value;
    // The list asks again on every redraw while it sits at its end, so a page
    // already on its way must not be asked for twice.
    if (_loadingMore || current == null || !current.hasMore) return;
    _loadingMore = true;
    try {
      final next = await SadhanaService.instance.chantSessions(
        mantraId: _mantraId,
        page: current.page + 1,
      );
      state = AsyncData(current.merge(next));
    } catch (_) {
      // The page already loaded stays; there is nothing useful to show for a
      // failed attempt at more.
    } finally {
      _loadingMore = false;
    }
  }
}

final chantHistoryProvider = AsyncNotifierProvider.family
    .autoDispose<ChantHistoryNotifier, Paged<ChantSessionSummary>, String?>(
  ChantHistoryNotifier.new,
);

/// One past sitting in full, fetched when its screen opens.
final chantSessionDetailProvider =
    FutureProvider.family.autoDispose<ChantSessionDetail, String>(
  (ref, id) => SadhanaService.instance.chantSession(id),
);
