import 'package:drift/drift.dart';

import '../app_database.dart';
import '../tables.dart';

part 'download_state_dao.g.dart';

/// "n of m units downloaded", as numbers the UI can watch.
class SyncSummary {
  const SyncSummary({this.total = 0, this.downloaded = 0, this.downloading = 0, this.failed = 0, this.pending = 0});

  /// Units the server lists for the book.
  final int total;
  final int downloaded;
  final int downloading;
  final int failed;
  final int pending;

  bool get isComplete => total > 0 && downloaded >= total;
  bool get isWorking => downloading > 0 || pending > 0;
  double get fraction => total == 0 ? 0 : (downloaded / total).clamp(0, 1).toDouble();

  @override
  bool operator ==(Object other) =>
      other is SyncSummary &&
      other.total == total &&
      other.downloaded == downloaded &&
      other.downloading == downloading &&
      other.failed == failed &&
      other.pending == pending;

  @override
  int get hashCode => Object.hash(total, downloaded, downloading, failed, pending);

  @override
  String toString() => 'SyncSummary($downloaded/$total, working $downloading+$pending, failed $failed)';
}

@DriftAccessor(tables: [DownloadStates, Books])
class DownloadStateDao extends DatabaseAccessor<AppDatabase> with _$DownloadStateDaoMixin {
  DownloadStateDao(super.db);

  Future<List<DownloadStateRecord>> statesFor(String bookId) =>
      (select(downloadStates)..where((s) => s.bookId.equals(bookId))).get();

  Stream<List<DownloadStateRecord>> watchStates(String bookId) =>
      (select(downloadStates)
            ..where((s) => s.bookId.equals(bookId))
            ..orderBy([(s) => OrderingTerm.asc(s.unitNumber)]))
          .watch();

  Stream<DownloadStateRecord?> watchUnit(String bookId, String unitId) =>
      (select(downloadStates)..where((s) => s.bookId.equals(bookId) & s.unitId.equals(unitId))).watchSingleOrNull();

  Future<DownloadStateRecord?> stateOf(String bookId, String unitId) =>
      (select(downloadStates)..where((s) => s.bookId.equals(bookId) & s.unitId.equals(unitId))).getSingleOrNull();

  /// Counts for one book, as one watched query. [Books.totalUnits] is the
  /// total, so the figure is right before any unit has a row.
  Selectable<SyncSummary> _summaryQuery(String bookId) {
    String count(UnitStatus status) =>
        "(SELECT COUNT(*) FROM download_state WHERE book_id = ?1 AND status = '${status.name}')";
    return customSelect(
      'SELECT COALESCE((SELECT total_units FROM books WHERE id = ?1), 0) AS total, '
      '(SELECT COUNT(*) FROM download_state WHERE book_id = ?1) AS listed, '
      '${count(UnitStatus.done)} AS done, ${count(UnitStatus.downloading)} AS downloading, '
      '${count(UnitStatus.failed)} AS failed, ${count(UnitStatus.pending)} AS pending',
      variables: [Variable<String>(bookId)],
      readsFrom: {downloadStates, books},
    ).map((row) {
      final total = row.read<int>('total');
      final listed = row.read<int>('listed');
      return SyncSummary(
        total: total < listed ? listed : total,
        downloaded: row.read<int>('done'),
        downloading: row.read<int>('downloading'),
        failed: row.read<int>('failed'),
        pending: row.read<int>('pending'),
      );
    });
  }

  Stream<SyncSummary> watchSummary(String bookId) => _summaryQuery(bookId).watchSingle().distinct();

  Future<SyncSummary> summary(String bookId) => _summaryQuery(bookId).getSingle();

  /// Marks a unit as wanted. A unit already `done` keeps its version and hash —
  /// they say what is on the device — so a newer version being available does
  /// not make the old text look missing.
  Future<void> markPending({
    required String bookId,
    required String unitId,
    required String unitType,
    required int unitNumber,
  }) async {
    final existing = await stateOf(bookId, unitId);
    if (existing == null) {
      await into(downloadStates).insert(
        DownloadStatesCompanion.insert(
          bookId: bookId,
          unitId: unitId,
          unitType: unitType,
          unitNumber: Value(unitNumber),
        ),
      );
      return;
    }
    if (UnitStatus.parse(existing.status) == UnitStatus.done) return;
    await (update(downloadStates)..where((s) => s.bookId.equals(bookId) & s.unitId.equals(unitId))).write(
      DownloadStatesCompanion(
        status: Value(UnitStatus.pending.name),
        unitNumber: Value(unitNumber),
      ),
    );
  }

  Future<void> markDownloading(String bookId, String unitId) async {
    await (update(downloadStates)..where((s) => s.bookId.equals(bookId) & s.unitId.equals(unitId))).write(
      DownloadStatesCompanion(status: Value(UnitStatus.downloading.name)),
    );
  }

  /// [retryCount] goes up by one; [lastError] is for the developer, not the
  /// reader. A unit that had a good copy keeps its version and hash.
  Future<void> markFailed(String bookId, String unitId, String error) async {
    final existing = await stateOf(bookId, unitId);
    if (existing == null) return;
    await (update(downloadStates)..where((s) => s.bookId.equals(bookId) & s.unitId.equals(unitId))).write(
      DownloadStatesCompanion(
        status: Value(UnitStatus.failed.name),
        retryCount: Value(existing.retryCount + 1),
        lastError: Value(error.length > 300 ? error.substring(0, 300) : error),
      ),
    );
  }

  /// Anything left `downloading` belongs to a process that no longer exists.
  Future<void> resetInterrupted() async {
    await (update(downloadStates)..where((s) => s.status.equals(UnitStatus.downloading.name))).write(
      DownloadStatesCompanion(status: Value(UnitStatus.pending.name)),
    );
  }

  /// Everything still owed — what the app picks back up after a restart.
  /// Failed units past [retryLimit] wait for the person to open the book.
  Future<List<DownloadStateRecord>> unfinished({required int retryLimit}) {
    return (select(downloadStates)
          ..where(
            (s) =>
                s.status.equals(UnitStatus.pending.name) |
                s.status.equals(UnitStatus.downloading.name) |
                (s.status.equals(UnitStatus.failed.name) & s.retryCount.isSmallerThanValue(retryLimit)),
          ))
        .get();
  }
}
