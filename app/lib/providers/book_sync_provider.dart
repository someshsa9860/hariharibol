import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../db/app_database.dart';
import '../db/daos/download_state_dao.dart';
import '../repositories/book_repository.dart';

/// "n of m chapters downloaded" for a book, by its id. Internal bookkeeping —
/// shown at most as a quiet badge, never as a blocking screen.
final bookSyncSummaryProvider = StreamProvider.family.autoDispose<SyncSummary, String>((ref, bookId) {
  return BookRepository.instance.watchSyncSummary(bookId);
});

/// Every unit's state for a book, in order — for a per-chapter "downloaded" mark.
final bookUnitStatesProvider =
    StreamProvider.family.autoDispose<List<DownloadStateRecord>, String>((ref, bookId) {
  return BookRepository.instance.watchUnitStates(bookId);
});
