import 'dart:async';

import 'package:hariharibol/models/book_cache.dart';
import 'package:hariharibol/services/book_cache_api.dart';
import 'package:hariharibol/services/book_unit_downloader.dart';
import 'package:hariharibol/services/sync_conditions.dart';

import 'book_fixtures.dart';

/// A server with a settable manifest. Counts calls so a test can say "once".
class FakeCacheApi implements BookCacheApi {
  FakeCacheApi(this.units, {this.bookId = 'book1', this.slug = 'srimad-bhagavatam'});

  List<ManifestUnit> units;
  final String bookId;
  final String slug;
  int manifestCalls = 0;
  Object? manifestError;
  final List<String> linkRequests = [];
  String urlFor(String unitId) => 'https://s3.test/$unitId';
  Map<String, UnitLink Function()> linkOverrides = {};

  @override
  Future<CacheManifest> manifest(String book) async {
    manifestCalls++;
    if (manifestError != null) throw manifestError!;
    return CacheManifest(bookId: bookId, bookSlug: slug, unitType: units.firstOrNull?.unitType, units: units, fetchedAt: DateTime.now());
  }

  @override
  Future<UnitLink> downloadUrl(String book, String unitId) async {
    linkRequests.add(unitId);
    final override = linkOverrides[unitId];
    if (override != null) return override();
    final unit = units.firstWhere((u) => u.unitId == unitId);
    return UnitLink(
      unitId: unitId,
      unitType: unit.unitType,
      url: urlFor(unitId),
      version: unit.version,
      hash: unit.hash,
      sizeBytes: unit.sizeBytes,
    );
  }

  @override
  Future<Map<String, String>> audioUrls(String book, List<String> verseIds) async => {};
}

ManifestUnit manifestUnit(int number, {int version = 1, String? hash, String type = 'canto'}) => ManifestUnit(
      unitId: '$type$number',
      unitType: type,
      number: number,
      version: version,
      hash: hash ?? 'hash-$number-v$version',
      sizeBytes: 1000,
      verseCount: 4,
    );

/// A downloader that "downloads" by building the unit's file from the fixture,
/// optionally taking time or failing, and records what it was asked for.
class FakeDownloader implements BookUnitDownloader {
  final List<String> started = [];
  final List<String> finished = [];
  int running = 0;
  int peak = 0;

  /// Completes a unit's download when called; by default immediately.
  Future<void> Function(String unitId)? gate;
  Object? Function(String unitId)? failure;

  @override
  Future<DownloadedUnit> download(String book, ManifestUnit unit) async {
    started.add(unit.unitId);
    running++;
    if (running > peak) peak = running;
    try {
      if (gate != null) await gate!(unit.unitId);
      final error = failure?.call(unit.unitId);
      if (error != null) throw error;
      final json = unitJson(unitId: unit.unitId, unitNumber: unit.number, unitType: unit.unitType, purportPrefix: 'v${unit.version}');
      finished.add(unit.unitId);
      return DownloadedUnit(payload: payloadOf(json), version: unit.version, hash: unit.hash);
    } finally {
      running--;
    }
  }

  @override
  int get attempts => 1;

  @override
  Duration backoff(int attempt) => Duration.zero;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeConditions implements SyncConditions {
  bool value = true;
  final StreamController<void> _changes = StreamController<void>.broadcast();

  @override
  Future<bool> allowed() async => value;

  @override
  Stream<void> get changes => _changes.stream;

  void set(bool allowed) {
    value = allowed;
    _changes.add(null);
  }
}
