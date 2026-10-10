import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/db/app_database.dart';
import 'package:hariharibol/models/book_cache.dart';
import 'package:hariharibol/services/book_sync_planner.dart';

import 'support/fakes_sync.dart';

DownloadStateRecord local(String unitId, {String status = 'done', int version = 1, String? hash, int retry = 0}) =>
    DownloadStateRecord(
      bookId: 'book1',
      unitId: unitId,
      unitType: 'canto',
      unitNumber: 0,
      status: status,
      version: version,
      hash: hash,
      retryCount: retry,
    );

CacheManifest manifestOf(List<ManifestUnit> units) =>
    CacheManifest(bookId: 'book1', bookSlug: 'sb', unitType: 'canto', units: units, fetchedAt: DateTime(2026));

void main() {
  group('needsDownload', () {
    final remote = manifestUnit(1, version: 3, hash: 'h3');

    test('a unit the device has never seen', () => expect(BookSyncPlanner.needsDownload(remote, null), isTrue));

    test('same version and hash is current', () {
      expect(BookSyncPlanner.needsDownload(remote, local('canto1', version: 3, hash: 'h3')), isFalse);
    });

    test('a higher version', () {
      expect(BookSyncPlanner.needsDownload(remote, local('canto1', version: 2, hash: 'h3')), isTrue);
    });

    test('a different hash at the same version', () {
      expect(BookSyncPlanner.needsDownload(remote, local('canto1', version: 3, hash: 'other')), isTrue);
    });

    test('an older server version never downgrades the device', () {
      final older = manifestUnit(1, version: 2, hash: 'h3');
      expect(BookSyncPlanner.needsDownload(older, local('canto1', version: 3, hash: 'h3')), isFalse);
    });

    for (final status in ['pending', 'downloading', 'failed']) {
      test('$status is not done, so it is wanted', () {
        expect(BookSyncPlanner.needsDownload(remote, local('canto1', status: status, version: 3, hash: 'h3')), isTrue);
      });
    }

    test('a unit newer than this app understands is left alone', () {
      final future = ManifestUnit(unitId: 'u', unitType: 'canto', number: 1, version: 1, hash: 'h', schemaVersion: 99);
      expect(BookSyncPlanner.needsDownload(future, null), isFalse);
    });
  });

  group('plan', () {
    final units = [for (var n = 1; n <= 6; n++) manifestUnit(n)];

    test('book order when nothing is being read', () {
      final plan = BookSyncPlanner.plan(manifestOf(units), {});
      expect(plan.map((u) => u.number), [1, 2, 3, 4, 5, 6]);
    });

    test('the unit being read first, then neighbours, the next before the previous', () {
      final plan = BookSyncPlanner.plan(manifestOf(units), {}, current: 3);
      expect(plan.map((u) => u.number), [3, 4, 2, 5, 1, 6]);
    });

    test('reading the first unit', () {
      expect(BookSyncPlanner.plan(manifestOf(units), {}, current: 1).map((u) => u.number), [1, 2, 3, 4, 5, 6]);
    });

    test('reading the last unit', () {
      expect(BookSyncPlanner.plan(manifestOf(units), {}, current: 6).map((u) => u.number), [6, 5, 4, 3, 2, 1]);
    });

    test('only what is missing or outdated, keeping the order', () {
      final have = {
        'canto1': local('canto1', version: 1, hash: 'hash-1-v1'),
        'canto2': local('canto2', version: 1, hash: 'stale'),
        'canto3': local('canto3', status: 'failed'),
        'canto4': local('canto4', version: 1, hash: 'hash-4-v1'),
      };
      final plan = BookSyncPlanner.plan(manifestOf(units), have, current: 3);
      expect(plan.map((u) => u.number), [3, 2, 5, 6]);
    });

    test('nothing to do when everything is current', () {
      final have = {for (final u in units) u.unitId: local(u.unitId, version: u.version, hash: u.hash)};
      expect(BookSyncPlanner.plan(manifestOf(units), have), isEmpty);
    });

    test('isOutdated is true only for a done unit the server has replaced', () {
      final remote = manifestUnit(1, version: 2, hash: 'new');
      expect(BookSyncPlanner.isOutdated(remote, local('canto1', hash: 'old')), isTrue);
      expect(BookSyncPlanner.isOutdated(remote, null), isFalse);
      expect(BookSyncPlanner.isOutdated(remote, local('canto1', status: 'failed')), isFalse);
    });
  });
}
