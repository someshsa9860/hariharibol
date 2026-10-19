import 'dart:async';

import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/constants/book_sync_config.dart';
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

  BookSyncManager build({
    int concurrency = 2,
    AppDatabase? database,
    DateTime Function()? clock,
    Duration? updateCheckInterval,
  }) =>
      BookSyncManager(
        db: database ?? db,
        api: api,
        downloader: downloader,
        conditions: conditions,
        maxConcurrent: concurrency,
        clock: clock,
        updateCheckInterval: updateCheckInterval ?? BookSyncConfig.updateCheckInterval,
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

  group('content version', () {
    Future<int> versionOnPhone() => db.bookDao.contentVersionOf('book1');

    /// The server re-exports canto 2 and says the book's text has moved on.
    void serverChangesCanto2({int contentVersion = 2}) {
      api.units = [for (final u in api.units) u.number == 2 ? manifestUnit(2, version: 2, hash: 'new-hash') : u];
      api.contentVersion = contentVersion;
    }

    test('is recorded once every unit of the book is on the device', () async {
      api.contentVersion = 3;
      await manager.syncBook('srimad-bhagavatam');
      expect(await versionOnPhone(), 3);
    });

    test('is not recorded while a unit is missing, and is by the next open', () async {
      api.contentVersion = 3;
      downloader.failure = (id) => id == 'canto3' ? Exception('connection reset') : null;
      await manager.syncBook('srimad-bhagavatam');
      expect(await versionOnPhone(), 0, reason: "the book is only partly the server's version");

      downloader.failure = null;
      manager = build();
      await manager.syncBook('srimad-bhagavatam');
      expect(await versionOnPhone(), 3);
    });

    test('is recorded when the text moved on but this phone already held every unit', () async {
      await manager.syncBook('srimad-bhagavatam');
      expect(await versionOnPhone(), 1);

      // The number alone moved: every unit the phone holds is still the server's.
      api.contentVersion = 5;
      await manager.checkForUpdates(force: true);
      expect(await versionOnPhone(), 5);
      expect(downloader.started, hasLength(5), reason: 'nothing was fetched again');
    });

    test('an ordinary open within the minute does not see new text; an update check does', () async {
      await manager.syncBook('srimad-bhagavatam');
      downloader.started.clear();
      serverChangesCanto2();

      await manager.syncBook('srimad-bhagavatam');
      expect(downloader.started, isEmpty, reason: 'the manifest from a moment ago is reused');
      expect(await versionOnPhone(), 1);

      await manager.checkForUpdates(force: true);
      expect(downloader.started, ['canto2'], reason: 'only the unit that changed');
      expect(await versionOnPhone(), 2);
      final verse = (await db.bookDao.versesOfChapter('ch2-1')).first;
      final translation = (await db.bookDao.translationsFor([verse.id]))[verse.id]!.firstWhere((t) => t.languageCode == 'en');
      expect(translation.purport, startsWith('v2'));
    });

    test('a new version whose unit cannot be fetched keeps the old text and the old version', () async {
      await manager.syncBook('srimad-bhagavatam');
      serverChangesCanto2();
      downloader.failure = (id) => id == 'canto2' ? Exception('boom') : null;

      await manager.checkForUpdates(force: true);

      expect(await versionOnPhone(), 1, reason: 'canto 2 is still the old one');
      expect(await db.bookDao.versesOfChapter('ch2-1'), isNotEmpty);

      downloader.failure = null;
      await manager.checkForUpdates(force: true);
      expect(await versionOnPhone(), 2);
    });

    test('a change of the cache version downloads everything again and records the content version', () async {
      await manager.syncBook('srimad-bhagavatam');
      downloader.started.clear();

      api.cacheVersion = 2;
      api.contentVersion = 4;
      await manager.checkForUpdates(force: true);

      expect(downloader.started, hasLength(5));
      expect(await versionOnPhone(), 4);
    });

    test('checks every book on the phone, and only those', () async {
      expect(await db.downloadStateDao.heldBookIds(), isEmpty);
      await manager.checkForUpdates(force: true);
      expect(api.manifestCalls, 0, reason: 'a phone with no book has nothing to ask about');

      await manager.syncBook('srimad-bhagavatam');
      api.manifestCalls = 0;
      await manager.checkForUpdates(force: true);
      expect(api.manifestCalls, 1);
    });

    test('is silent offline: nothing thrown, nothing changed', () async {
      await manager.syncBook('srimad-bhagavatam');
      downloader.started.clear();
      serverChangesCanto2();
      api.manifestError = Exception('offline');

      await manager.checkForUpdates(force: true);

      expect(downloader.started, isEmpty);
      expect(await versionOnPhone(), 1);
      expect((await db.downloadStateDao.summary('book1')).isComplete, isTrue);
    });

    test('nothing downloads while the network is not allowed, and it carries on when it is', () async {
      await manager.syncBook('srimad-bhagavatam');
      downloader.started.clear();
      serverChangesCanto2();

      conditions.set(false);
      await pumpEventQueue();
      final check = manager.checkForUpdates(force: true);
      await pumpEventQueue();
      expect(downloader.started, isEmpty);
      expect(await versionOnPhone(), 1);

      conditions.set(true);
      await check;
      expect(downloader.started, ['canto2']);
      expect(await versionOnPhone(), 2);
    });

    group('how often', () {
      var skew = Duration.zero;
      DateTime clock() => DateTime.now().add(skew);

      setUp(() {
        skew = Duration.zero;
        manager = build(clock: clock);
      });

      test('a check within the interval of the last one does not ask the server', () async {
        await manager.syncBook('srimad-bhagavatam');
        await manager.checkForUpdates();
        final calls = api.manifestCalls;

        skew = BookSyncConfig.updateCheckInterval - const Duration(minutes: 1);
        await manager.checkForUpdates();
        expect(api.manifestCalls, calls);
      });

      test('after the interval it asks again', () async {
        await manager.syncBook('srimad-bhagavatam');
        await manager.checkForUpdates();
        final calls = api.manifestCalls;
        serverChangesCanto2();
        downloader.started.clear();

        skew = BookSyncConfig.updateCheckInterval + const Duration(minutes: 1);
        await manager.checkForUpdates();
        expect(api.manifestCalls, calls + 1);
        expect(downloader.started, ['canto2']);
      });

      test('forcing it ignores the interval', () async {
        await manager.syncBook('srimad-bhagavatam');
        await manager.checkForUpdates();
        final calls = api.manifestCalls;

        await manager.checkForUpdates(force: true);
        expect(api.manifestCalls, calls + 1);
      });
    });

    test('starting the app finishes what was owed and then looks for new text', () async {
      // A first run left canto 1 owed; meanwhile the server has moved on.
      await manager.syncBook('srimad-bhagavatam');
      await db.downloadStateDao.markFailed('book1', 'canto1', 'connection reset');
      downloader.started.clear();
      serverChangesCanto2();

      manager = build();
      await manager.onAppStart();

      expect(downloader.started.toSet(), {'canto1', 'canto2'});
      expect(await versionOnPhone(), 2);
      expect((await db.downloadStateDao.summary('book1')).isComplete, isTrue);
    });
  });

  group('book cache version', () {
    /// Puts a marker in canto 1's text, so a test can tell "still the copy that
    /// was there" from "downloaded again": the fake server never sends it.
    Future<void> scribbleOnCanto1() async {
      final verse = (await db.bookDao.versesOfChapter('ch1-1')).first;
      await db.customStatement("UPDATE verse_translations SET purport = 'old copy' WHERE verse_row_id = ?", [verse.id]);
    }

    Future<String?> purportOfCanto1() async {
      final verse = (await db.bookDao.versesOfChapter('ch1-1')).first;
      final translations = (await db.bookDao.translationsFor([verse.id]))[verse.id]!;
      return translations.firstWhere((t) => t.languageCode == 'en').purport;
    }

    test('units are saved under the version the manifest named', () async {
      api.cacheVersion = 4;
      await manager.syncBook('srimad-bhagavatam');
      final states = await db.downloadStateDao.statesFor('book1');
      expect(states, hasLength(5));
      expect(states.map((s) => s.cacheVersion).toSet(), {4});
    });

    test('the same version leaves the device alone, even if its text differs', () async {
      await manager.syncBook('srimad-bhagavatam');
      await scribbleOnCanto1();
      downloader.started.clear();

      manager = build();
      await manager.syncBook('srimad-bhagavatam');
      expect(downloader.started, isEmpty);
      expect(await purportOfCanto1(), 'old copy');
    });

    test('a new version deletes every unit of the book and downloads it again', () async {
      await manager.syncBook('srimad-bhagavatam');
      await scribbleOnCanto1();
      downloader.started.clear();

      api.cacheVersion = 2;
      manager = build();
      await manager.syncBook('srimad-bhagavatam');

      expect(downloader.started.toSet(), {'canto1', 'canto2', 'canto3', 'canto4', 'canto5'});
      expect(downloader.started, hasLength(5), reason: 'each once');
      expect(await purportOfCanto1(), isNot('old copy'));
      final states = await db.downloadStateDao.statesFor('book1');
      expect(states.map((s) => (UnitStatus.parse(s.status), s.cacheVersion)).toSet(), {(UnitStatus.done, 2)});
      expect((await db.downloadStateDao.summary('book1')).isComplete, isTrue);
    });

    test('once downloaded again, the next open does nothing more', () async {
      await manager.syncBook('srimad-bhagavatam');
      api.cacheVersion = 2;
      manager = build();
      await manager.syncBook('srimad-bhagavatam');
      downloader.started.clear();

      manager = build();
      await manager.syncBook('srimad-bhagavatam');
      expect(downloader.started, isEmpty);
    });

    test('lowering the version deletes and downloads again too', () async {
      api.cacheVersion = 3;
      await manager.syncBook('srimad-bhagavatam');
      downloader.started.clear();

      api.cacheVersion = 2;
      manager = build();
      await manager.syncBook('srimad-bhagavatam');
      expect(downloader.started, hasLength(5));
    });

    test('with no network the old copy stays: nothing is deleted until the server has been asked', () async {
      await manager.syncBook('srimad-bhagavatam');
      await scribbleOnCanto1();
      downloader.started.clear();

      api.cacheVersion = 2;
      api.manifestError = Exception('offline');
      manager = build();
      await manager.syncBook('srimad-bhagavatam');

      expect(downloader.started, isEmpty);
      expect(await purportOfCanto1(), 'old copy');
      expect((await db.downloadStateDao.summary('book1')).downloaded, 5);
    });

    test('a reader asking for one unit gets a fresh copy, not the deleted one', () async {
      await manager.syncBook('srimad-bhagavatam');
      await scribbleOnCanto1();
      downloader.started.clear();

      api.cacheVersion = 2;
      manager = build();
      expect(await manager.ensureUnit('srimad-bhagavatam', 1), isTrue);
      expect(downloader.started, ['canto1']);
      expect(await purportOfCanto1(), isNot('old copy'));
    });

    test('a download that fails after the delete is picked up by the next open', () async {
      await manager.syncBook('srimad-bhagavatam');
      downloader.started.clear();

      api.cacheVersion = 2;
      downloader.failure = (id) => id == 'canto3' ? Exception('connection reset') : null;
      manager = build();
      await manager.syncBook('srimad-bhagavatam');
      expect(await statusOf('canto3'), UnitStatus.failed);
      expect(await db.bookDao.versesOfChapter('ch3-1'), isEmpty);

      downloader
        ..failure = null
        ..started.clear();
      manager = build();
      await manager.syncBook('srimad-bhagavatam');
      expect(downloader.started, ['canto3']);
      expect((await db.downloadStateDao.summary('book1')).isComplete, isTrue);
    });
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
