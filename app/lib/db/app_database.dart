import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'daos/book_dao.dart';
import 'daos/download_state_dao.dart';
import 'daos/search_dao.dart';
import 'tables.dart';

part 'app_database.g.dart';

/// The offline library: whatever a reader has downloaded, kept on the device
/// regardless of network state or sign-out.
///
/// Never cleared on logout — see `AppSession.clear()`, which does not touch
/// this database. A book someone downloaded belongs to the device, not the
/// session.
///
/// Schema history:
///   1  one language per cached chapter, written by the reading screen.
///   2  every language per unit, written only by the sync (`BookDao.replaceUnit`);
///      per-unit `download_state`; FTS5 search. Version 1 held a cache that the
///      sync refills silently, so it is dropped, not converted.
@DriftDatabase(
  tables: [Books, Units, Verses, VerseTranslations, DownloadStates],
  daos: [BookDao, DownloadStateDao, SearchDao],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.executor);

  /// The one the app uses. Tests build their own over an in-memory executor.
  static final AppDatabase instance = AppDatabase(driftDatabase(name: 'hariharibol'));

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
          await searchDao.createIndex();
        },
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            for (final old in const [
              'downloaded_verse_texts',
              'downloaded_verses',
              'downloaded_chapters',
              'downloaded_books',
              'canto_downloads',
              'book_downloads',
            ]) {
              await customStatement('DROP TABLE IF EXISTS $old');
            }
            await m.createAll();
            await searchDao.createIndex();
          }
        },
        beforeOpen: (details) async {
          await customStatement('PRAGMA foreign_keys = OFF');
          // A unit left `downloading` by a killed app is not downloading.
          if (!details.wasCreated) await downloadStateDao.resetInterrupted();
        },
      );
}
