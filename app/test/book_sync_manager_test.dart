import 'dart:async';

import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/db/app_database.dart';
import 'package:hariharibol/db/tables.dart';
import 'package:hariharibol/services/book_sync_manager.dart';

import 'support/book_fixtures.dart';
import 'support/fakes_sync.dart';

void main() {
  late AppDatabase db;
  late FakeCacheApi api;
  late FakeDownloader downloader;
  late FakeConditions conditions;
  late BookSyncManager manager;

  BookSyncManager build({int concurrency = 2, AppDatabase? database}) => BookSyncManager(
        db: database ?? db,
        api: api,
        downloader: downloader,
        conditions: conditions,
        maxConcurrent: concurrency,
      );

  setUpAll(() => driftRuntimeOptions.dontWarnAboutMultipleDatabases = true);

  setUp(() {
    db = memoryDb();
    api = FakeCacheApi([for (var n = 1; n <= 5; n++) manifestUnit(n)]);
    downloader = FakeDownloader();
    conditions = FakeConditions();
    manager = build();
  });

  tearDown(() async {
    await manager.dispose();
    await db.close();
  });

  /// The database answers on later turns of the event loop, so "wait a tick"
  /// is not enough: poll until [condition] holds.
  Future<void> until(bool Function() condition) async {
    for (var i = 0; i < 400 && !condition(); i++) {
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    expect(condition(), isTrue, reason: 'timed out waiting');
  }

  Future<UnitStatus> statusOf(String unitId) async =>
      UnitStatus.parse((await db.downloadStateDao.stateOf('book1', unitId))?.status);

  test('opening a book downloads every unit and records them as done', () async {
    await manager.syncBook('srimad-bhagavatam');

    expect(downloader.finished.toSet(), {'canto1', 'canto2', 'canto3', 'canto4', 'canto5'});
    for (var n = 1; n <= 5; n++) {
      expect(await statusOf('canto$n'), UnitStatus.done);
    }
    final summary = await db.downloadStateDao.summary('book1');
    expect((summary.total, summary.downloaded), (5, 5));
    expect(summary.isComplete, isTrue);
    expect(await db.bookDao.versesOfChapter('ch1-1'), isNotEmpty);
  });

  test('opening it again downloads nothing: the versions and hashes match', () async {
    await manager.syncBook('srimad-bhagavatam');
    downloader.started.clear();

    manager = build();
    await manager.syncBook('srimad-bhagavatam');
    expect(downloader.started, isEmpty);
  });

  test('only the changed unit is downloaded again, and its old text is replaced', () async {
    await manager.syncBook('srimad-bhagavatam');
    downloader.started.clear();

    api.units = [for (final u in api.units) u.number == 2 ? manifestUnit(2, version: 2, hash: 'new-hash') : u];
    manager = build();
    await manager.syncBook('srimad-bhagavatam');

    expect(downloader.started, ['canto2']);
    final state = await db.downloadStateDao.stateOf('book1', 'canto2');
    expect((state!.version, state.hash), (2, 'new-hash'));
    final verse = (await db.bookDao.versesOfChapter('ch2-1')).first;
    final translation = (await db.bookDao.translationsFor([verse.id]))[verse.id]!.firstWhere((t) => t.languageCode == 'en');
    expect(translation.purport, startsWith('v2'));
  });

  test('a later server version never reaches the device older than what it holds', () async {
    await manager.syncBook('srimad-bhagavatam');
    downloader.started.clear();
    api.units = [for (final u in api.units) u.number == 1 ? manifestUnit(1, version: 0, hash: 'rolled-back') : u];
    manager = build();
    await manager.syncBook('srimad-bhagavatam');
    // hash differs, so it is fetched: content is what is compared, not just the number
    expect(downloader.started, ['canto1']);
  });

  test('the unit being read is downloaded first, then its neighbours', () async {
    manager = build(concurrency: 1);
    await manager.syncBook('srimad-bhagavatam', current: 3);
    expect(downloader.started, ['canto3', 'canto4', 'canto2', 'canto5', 'canto1']);
  });

  test('never more than the concurrency limit at once', () async {
    final gates = <String, Completer<void>>{};
    downloader.gate = (id) => (gates[id] = Completer<void>()).future;
    final sync = manager.syncBook('srimad-bhagavatam');

    await until(() => downloader.running == 2);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(downloader.running, 2, reason: 'a third must wait');
    expect(downloader.started, hasLength(2));

    while (downloader.finished.length < 5) {
      for (final g in gates.values.where((g) => !g.isCompleted)) {
        g.complete();
      }
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    await sync;
    expect(downloader.peak, 2);
    expect(downloader.finished, hasLength(5));
  });

  test('opening the same book twice at once downloads each unit once', () async {
    final gate = Completer<void>();
    downloader.gate = (_) => gate.future;
    final a = manager.syncBook('srimad-bhagavatam');
    final b = manager.syncBook('srimad-bhagavatam', current: 4);
    await pumpEventQueue();
    gate.complete();
    await Future.wait([a, b]);

    expect(downloader.started.toSet(), hasLength(5));
    expect(downloader.started, hasLength(5));
    expect(api.manifestCalls, 1);
  });

  test('a reader waiting on a queued unit moves it to the front', () async {
    manager = build(concurrency: 1);
    final gates = <String, Completer<void>>{};
    downloader.gate = (id) => (gates[id] = Completer<void>()).future;

    final sync = manager.syncBook('srimad-bhagavatam');
    await until(() => downloader.started.isNotEmpty);
    expect(downloader.started, ['canto1']);

    final arrived = manager.ensureUnit('srimad-bhagavatam', 5);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    gates['canto1']!.complete();
    await until(() => downloader.started.length == 2);
    expect(downloader.started, ['canto1', 'canto5']);

    while (downloader.finished.length < 5) {
      for (final g in gates.values.where((g) => !g.isCompleted)) {
        g.complete();
      }
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    expect(await arrived, isTrue);
    await sync;
  });

  test('nothing downloads while the network is not allowed, and it carries on when it is', () async {
    conditions.value = false;
    manager = build();
    await pumpEventQueue();

    final sync = manager.syncBook('srimad-bhagavatam');
    await pumpEventQueue();
    expect(downloader.started, isEmpty);
    expect(await statusOf('canto1'), UnitStatus.pending);

    conditions.set(true);
    await sync;
    expect(downloader.finished, hasLength(5));
  });

  test('a failed unit is marked failed, the rest finish, and the next open retries only it', () async {
    downloader.failure = (id) => id == 'canto3' ? Exception('connection reset') : null;
    await manager.syncBook('srimad-bhagavatam');

    expect(await statusOf('canto3'), UnitStatus.failed);
    final failed = await db.downloadStateDao.stateOf('book1', 'canto3');
    expect(failed!.retryCount, 1);
    expect(failed.lastError, contains('connection reset'));
    expect((await db.downloadStateDao.summary('book1')).downloaded, 4);
    expect(await db.bookDao.versesOfChapter('ch3-1'), isEmpty);

    downloader
      ..failure = null
      ..started.clear();
    manager = build();
    await manager.syncBook('srimad-bhagavatam');
    expect(downloader.started, ['canto3']);
    expect(await statusOf('canto3'), UnitStatus.done);
    expect((await db.downloadStateDao.stateOf('book1', 'canto3'))!.retryCount, 0);
  });

  test('a failed unit keeps the good copy it already had', () async {
    await manager.syncBook('srimad-bhagavatam');
    api.units = [for (final u in api.units) u.number == 2 ? manifestUnit(2, version: 2, hash: 'new') : u];
    downloader.failure = (id) => id == 'canto2' ? Exception('boom') : null;
    manager = build();
    await manager.syncBook('srimad-bhagavatam');

    expect(await statusOf('canto2'), UnitStatus.failed);
    expect(await db.bookDao.versesOfChapter('ch2-1'), isNotEmpty, reason: 'old text still readable');
    expect((await db.downloadStateDao.stateOf('book1', 'canto2'))!.version, 1);
  });

  test('a manifest that cannot be fetched is silent and changes nothing', () async {
    api.manifestError = Exception('offline');
    await manager.syncBook('srimad-bhagavatam'); // must not throw
    expect(downloader.started, isEmpty);
    expect(await db.select(db.downloadStates).get(), isEmpty);
  });

  test('ensureUnit: true once the unit is on the device, false for a unit the server does not list', () async {
    expect(await manager.ensureUnit('srimad-bhagavatam', 2), isTrue);
    expect(await statusOf('canto2'), UnitStatus.done);
    expect(await manager.ensureUnit('srimad-bhagavatam', 99), isFalse);
  });

  test('ensureUnit on a unit already current does not download it again', () async {
    await manager.ensureUnit('srimad-bhagavatam', 2);
    downloader.started.clear();
    expect(await manager.ensureUnit('srimad-bhagavatam', 2), isTrue);
    expect(downloader.started, isEmpty);
  });

  test('ensureUnit is false when the download fails, so the reader falls back to the API', () async {
    downloader.failure = (_) => Exception('nope');
    expect(await manager.ensureUnit('srimad-bhagavatam', 2), isFalse);
  });

  test('after a restart, units left pending or interrupted are picked up again', () async {
    // A previous run planned two units and died while one was downloading.
    await db.downloadStateDao.markPending(bookId: 'book1', unitId: 'canto1', unitType: 'canto', unitNumber: 1);
    await db.downloadStateDao.markPending(bookId: 'book1', unitId: 'canto2', unitType: 'canto', unitNumber: 2);
    await db.downloadStateDao.markDownloading('book1', 'canto2');
    await db.downloadStateDao.resetInterrupted(); // what the database does on open

    manager = build();
    expect(await manager.hasWork(), isTrue);
    await manager.resumePending();
    expect(downloader.finished.toSet(), {'canto1', 'canto2', 'canto3', 'canto4', 'canto5'});
    expect(await manager.hasWork(), isFalse);
  });

  test('the network coming back retries what failed for lack of it', () async {
    downloader.failure = (id) => id == 'canto2' ? Exception('socket') : null;
    await manager.syncBook('srimad-bhagavatam');
    expect(await statusOf('canto2'), UnitStatus.failed);

    downloader.failure = null;
    conditions.set(false);
    await pumpEventQueue();
    conditions.set(true);
    await manager.idle();
    await pumpEventQueue();
    await manager.idle();
    expect(await statusOf('canto2'), UnitStatus.done);
  });

  test('summary stream reports progress', () async {
    final seen = <int>[];
    final sub = manager.watchSummary('book1').listen((s) => seen.add(s.downloaded));
    await manager.syncBook('srimad-bhagavatam');
    await pumpEventQueue();
    await sub.cancel();
    expect(seen.last, 5);
    expect(seen, equals([...seen]..sort()), reason: 'never goes backwards');
  });
}
