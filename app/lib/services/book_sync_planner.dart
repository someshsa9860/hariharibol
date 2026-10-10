import '../core/constants/book_sync_config.dart';
import '../db/app_database.dart';
import '../db/tables.dart';
import '../models/book_cache.dart';

/// What to download, and in what order. Pure — no database, no network — so the
/// rules are tested on their own (`test/book_sync_planner_test.dart`).
abstract final class BookSyncPlanner {
  /// Whether [remote] needs fetching given what the device has ([local], null if
  /// it has nothing). A unit is wanted when it is missing, was never finished,
  /// or the server has a different version or content.
  static bool needsDownload(ManifestUnit remote, DownloadStateRecord? local, {int? maxSchema}) {
    if (remote.schemaVersion > (maxSchema ?? BookSyncConfig.supportedSchemaVersion)) return false;
    if (local == null) return true;
    if (UnitStatus.parse(local.status) != UnitStatus.done) return true;
    return remote.version > local.version || remote.hash != local.hash;
  }

  /// The units to download, nearest [current] first.
  ///
  /// [current] is the chapter or canto number the reader is on: that unit comes
  /// first, then its neighbours by distance (the next one before the previous,
  /// since people read forwards), then everything else in book order. With no
  /// [current] it is simply book order.
  static List<ManifestUnit> plan(
    CacheManifest manifest,
    Map<String, DownloadStateRecord> local, {
    int? current,
    int? maxSchema,
  }) {
    final wanted = [
      for (final unit in manifest.units)
        if (needsDownload(unit, local[unit.unitId], maxSchema: maxSchema)) unit,
    ];
    return prioritise(wanted, current);
  }

  static List<ManifestUnit> prioritise(List<ManifestUnit> units, int? current) {
    final sorted = [...units]..sort((a, b) => a.number.compareTo(b.number));
    if (current == null) return sorted;
    sorted.sort((a, b) {
      final da = (a.number - current).abs(), db = (b.number - current).abs();
      if (da != db) return da.compareTo(db);
      // Equal distance: the one after the reader's place first.
      return b.number.compareTo(a.number);
    });
    return sorted;
  }

  /// Units that have a local copy at a version the server has since replaced —
  /// readable now, refreshed in the background.
  static bool isOutdated(ManifestUnit remote, DownloadStateRecord? local) =>
      local != null &&
      UnitStatus.parse(local.status) == UnitStatus.done &&
      (remote.version > local.version || remote.hash != local.hash);
}
