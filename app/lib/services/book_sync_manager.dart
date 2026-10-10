import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/constants/book_sync_config.dart';
import '../db/app_database.dart';
import '../db/daos/download_state_dao.dart';
import '../models/book_cache.dart';
import 'book_cache_api.dart';
import 'book_sync_planner.dart';
import 'book_unit_downloader.dart';
import 'sync_conditions.dart';

/// Keeps every book the reader opens available offline, silently.
///
/// Opening a book calls [syncBook]. That fetches the manifest, compares it with
/// `download_state`, and queues only the units that are missing or out of date,
/// the one being read first. The queue runs a couple at a time, holds still
/// while the network is not allowed, remembers what it owes in the database (so
/// a restart carries on — [resumePending]), and never starts a unit twice.
///
/// Nothing here shows anything. State is in `download_state`; [watchSummary]
/// and the per-unit streams are for an optional "Downloaded" badge.
class BookSyncManager {
  BookSyncManager({
    required this._db,
    required this._api,
    required this._downloader,
    required this._conditions,
    this._maxConcurrent = BookSyncConfig.maxConcurrent,
    this._manifestTtl = BookSyncConfig.manifestTtl,
    DateTime Function()? clock,
  }) : _now = clock ?? DateTime.now {
    _conditionsSub = _conditions.changes.listen((_) => _onConditionsChanged());
    unawaited(_refreshAllowed());
  }

  /// The app's one manager. Built on first use so the background isolate
  /// (which never runs `main`) gets one too. Tests assign their own.
  static BookSyncManager get instance => _instance ??= _build();
  static BookSyncManager? _instance;

  @visibleForTesting
  static set instance(BookSyncManager? manager) => _instance = manager;

  static BookSyncManager _build() {
    final api = BookCacheApi();
    return BookSyncManager(
      db: AppDatabase.instance,
      api: api,
      downloader: BookUnitDownloader(api: api),
      conditions: DeviceSyncConditions(),
    );
  }

  final AppDatabase _db;
  final BookCacheApi _api;
  final BookUnitDownloader _downloader;
  final SyncConditions _conditions;
  final int _maxConcurrent;
  final Duration _manifestTtl;
  final DateTime Function() _now;

  StreamSubscription<void>? _conditionsSub;
  bool _allowed = true;

  final Map<String, CacheManifest> _manifests = {};
  final Map<String, Future<CacheManifest>> _manifestInFlight = {};

  /// Queued and running units, by `bookId:unitId` — the de-duplication.
  final Map<String, _Job> _jobs = {};
  int _running = 0;

  /// Books being planned right now, by reference, so opening one twice at once
  /// plans it once.
  final Map<String, Future<void>> _planning = {};

  /// Books opened this session — retried when the network comes back.
  final Set<String> _opened = {};
  final List<Completer<void>> _idleWaiters = [];

  // ── What the UI watches ───────────────────────────────────────────────

  Stream<SyncSummary> watchSummary(String bookId) => _db.downloadStateDao.watchSummary(bookId);
  Stream<List<DownloadStateRecord>> watchStates(String bookId) => _db.downloadStateDao.watchStates(bookId);
  Stream<DownloadStateRecord?> watchUnit(String bookId, String unitId) =>
      _db.downloadStateDao.watchUnit(bookId, unitId);

  // ── Triggers ──────────────────────────────────────────────────────────

  /// A book was opened. Fire and forget; never throws, never shows anything.
  /// [current] is the chapter (or canto) number being read, to download first.
  void onBookOpened(String book, {int? current}) {
    unawaited(syncBook(book, current: current));
  }

  /// Plans and runs the sync for [book] (a slug or id); completes when every
  /// unit it queued has finished or failed. Errors are swallowed: a book that
  /// cannot sync now simply tries again the next time it is opened.
  Future<void> syncBook(String book, {int? current}) {
    _opened.add(book);
    final running = _planning[book];
    if (running != null) {
      if (current != null) _reprioritise(current);
      return running;
    }
    // A block body, not `=> remove(...)`: `remove` returns the very future
    // being completed, and whenComplete waits for whatever it returns.
    final future = _plan(book, current: current).whenComplete(() {
      _planning.remove(book);
      _notifyIdleIfDone();
    });
    _planning[book] = future;
    return future;
  }

  /// A reader opened a unit that is not on the device. Queues it ahead of
  /// everything and completes with whether it arrived. False means "use the
  /// network directly" (not exported, offline, or it failed).
  Future<bool> ensureUnit(String book, int number) async {
    try {
      final manifest = await _manifest(book);
      final unit = manifest.byNumber(number);
      if (unit == null || !BookSyncPlanner.needsDownload(unit, await _stateOf(manifest.bookId, unit.unitId))) {
        return unit != null;
      }
      return await _enqueue(manifest, unit, priority: -1000);
    } catch (error) {
      _log('ensureUnit($book, $number) failed: $error');
      return false;
    }
  }

  /// Picks up what a previous run left owed — pending, interrupted and failed
  /// units — for every book that has any. Called at app start and by the
  /// background task.
  Future<void> resumePending() async {
    final owed = await _db.downloadStateDao.unfinished(retryLimit: BookSyncConfig.autoRetryLimit);
    final books = owed.map((s) => s.bookId).toSet();
    await Future.wait(books.map((id) => syncBook(id)));
  }

  /// Whether there is anything left to do — queued now, or owed from before.
  /// What decides whether to ask the OS for a background pass.
  Future<bool> hasWork() async {
    if (isBusy) return true;
    return (await _db.downloadStateDao.unfinished(retryLimit: BookSyncConfig.autoRetryLimit)).isNotEmpty;
  }

  /// True while anything is queued or running.
  bool get isBusy => _jobs.isNotEmpty || _planning.isNotEmpty;

  /// Completes when there is nothing queued or running.
  Future<void> idle() {
    if (!isBusy) return Future.value();
    final waiter = Completer<void>();
    _idleWaiters.add(waiter);
    return waiter.future;
  }

  Future<void> dispose() async {
    await _conditionsSub?.cancel();
  }

  // ── Planning ──────────────────────────────────────────────────────────

  Future<void> _plan(String book, {int? current}) async {
    try {
      final manifest = await _manifest(book);
      await _db.bookDao.setTotalUnits(manifest.bookId, manifest.totalUnits);

      final local = {for (final s in await _db.downloadStateDao.statesFor(manifest.bookId)) s.unitId: s};
      final wanted = BookSyncPlanner.plan(manifest, local, current: current);

      final waits = <Future<bool>>[];
      for (var i = 0; i < wanted.length; i++) {
        waits.add(_enqueue(manifest, wanted[i], priority: i.toDouble()));
      }
      await Future.wait(waits);
    } catch (error) {
      _log('syncBook($book) failed: $error');
    } finally {
      _notifyIdleIfDone();
    }
  }

  Future<CacheManifest> _manifest(String book) {
    final cached = _manifests[book];
    if (cached != null && _now().difference(cached.fetchedAt) < _manifestTtl) return Future.value(cached);
    return _manifestInFlight[book] ??= _api.manifest(book).then((manifest) {
      _manifests[book] = manifest;
      return manifest;
    }).whenComplete(() {
      _manifestInFlight.remove(book);
    });
  }

  Future<DownloadStateRecord?> _stateOf(String bookId, String unitId) =>
      _db.downloadStateDao.stateOf(bookId, unitId);

  // ── The queue ─────────────────────────────────────────────────────────

  Future<bool> _enqueue(CacheManifest manifest, ManifestUnit unit, {required double priority}) async {
    final key = '${manifest.bookId}:${unit.unitId}';
    final existing = _jobs[key];
    if (existing != null) {
      // Already queued or running: keep one job, give it the better priority.
      if (priority < existing.priority) existing.priority = priority;
      final waiter = Completer<bool>();
      existing.waiters.add(waiter);
      return waiter.future;
    }

    await _db.downloadStateDao.markPending(
      bookId: manifest.bookId,
      unitId: unit.unitId,
      unitType: unit.unitType,
      unitNumber: unit.number,
    );

    final job = _Job(
      key: key,
      bookRef: manifest.bookSlug.isEmpty ? manifest.bookId : manifest.bookSlug,
      manifest: manifest,
      unit: unit,
      priority: priority,
    );
    final waiter = Completer<bool>();
    job.waiters.add(waiter);
    _jobs[key] = job;
    _pump();
    return waiter.future;
  }

  /// Starts queued jobs, best priority first, up to the concurrency limit —
  /// and only while the network is allowed.
  void _pump() {
    if (!_allowed) return;
    while (_running < _maxConcurrent) {
      final next = _nextQueued();
      if (next == null) return;
      next.started = true;
      _running++;
      unawaited(_run(next));
    }
  }

  _Job? _nextQueued() {
    _Job? best;
    for (final job in _jobs.values) {
      if (job.started) continue;
      if (best == null || job.priority < best.priority) best = job;
    }
    return best;
  }

  Future<void> _run(_Job job) async {
    var ok = false;
    try {
      await _db.downloadStateDao.markDownloading(job.manifest.bookId, job.unit.unitId);
      final downloaded = await _downloader.download(job.bookRef, job.unit);
      await _db.bookDao.replaceUnit(
        downloaded.payload,
        version: downloaded.version,
        hash: downloaded.hash,
        totalUnits: job.manifest.totalUnits,
      );
      ok = true;
    } catch (error) {
      _log('unit ${job.key} failed: $error');
      await _db.downloadStateDao.markFailed(job.manifest.bookId, job.unit.unitId, error.toString());
    } finally {
      _jobs.remove(job.key);
      _running--;
      for (final waiter in job.waiters) {
        if (!waiter.isCompleted) waiter.complete(ok);
      }
      _pump();
      _notifyIdleIfDone();
    }
  }

  /// The reader moved on: re-rank what is still waiting around [current].
  void _reprioritise(int current) {
    final queued = _jobs.values.where((j) => !j.started).toList();
    final order = BookSyncPlanner.prioritise([for (final j in queued) j.unit], current);
    for (var i = 0; i < order.length; i++) {
      final job = queued.firstWhere((j) => j.unit.unitId == order[i].unitId);
      if (i.toDouble() < job.priority) job.priority = i.toDouble();
    }
  }

  // ── Network ───────────────────────────────────────────────────────────

  Future<void> _refreshAllowed() async {
    try {
      _allowed = await _conditions.allowed();
    } catch (_) {
      _allowed = true;
    }
  }

  Future<void> _onConditionsChanged() async {
    final before = _allowed;
    await _refreshAllowed();
    if (!_allowed) return;
    _pump();
    if (!before) {
      // Back online: anything that failed for want of a network gets another go.
      for (final book in _opened.toList()) {
        unawaited(syncBook(book));
      }
    }
  }

  void _notifyIdleIfDone() {
    if (isBusy) return;
    for (final waiter in _idleWaiters) {
      if (!waiter.isCompleted) waiter.complete();
    }
    _idleWaiters.clear();
  }

  void _log(String message) {
    if (kDebugMode) debugPrint('[BookSync] $message');
  }
}

class _Job {
  _Job({
    required this.key,
    required this.bookRef,
    required this.manifest,
    required this.unit,
    required this.priority,
  });

  final String key;
  final String bookRef;
  final CacheManifest manifest;
  final ManifestUnit unit;
  double priority;
  bool started = false;
  final List<Completer<bool>> waiters = [];
}
