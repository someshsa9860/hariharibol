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
///   3  `download_state.cache_version`: which book cache version a unit was saved
///      under, so the server can ask for the offline books to be deleted and fetched
///      again. Existing rows get 1, the version before there was one.
///   4  `verse_translations.transliteration`: a verse in each language's own script.
///      Existing rows have none until their unit is downloaded again, which the
///      server's new file hash asks for.
///   5  `books.content_version`: the server's version of the book's text that the
///      device's copy was last made current at, so a new import is noticed. Existing
///      books get 0 ("not known"), which the next sync replaces.
@DriftDatabase(
  tables: [Books, Units, Verses, VerseTranslations, DownloadStates],
  daos: [BookDao, DownloadStateDao, SearchDao],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.executor);

  /// The one the app uses. Tests build their own over an in-memory executor.
  static final AppDatabase instance = AppDatabase(driftDatabase(name: 'hariharibol'));

  @override
  int get schemaVersion => 6;

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
            // Built at the newest shape, so it already has everything below.
            await m.createAll();
            await searchDao.createIndex();
          } else {
            if (from < 3) await m.addColumn(downloadStates, downloadStates.cacheVersion);
            if (from < 4) await m.addColumn(verseTranslations, verseTranslations.transliteration);
            if (from < 5) await m.addColumn(books, books.contentVersion);
            if (from < 6) {
              await m.addColumn(verseTranslations, verseTranslations.wordMeanings);
              // Units saved before the column cannot hold the per-language word
              // meanings the server sends with them. Forgetting their hash makes
              // the next sync fetch each again; the text already here stays
              // readable until its replacement arrives.
              await customStatement("UPDATE download_state SET hash = NULL WHERE status = 'done'");
            }
          }
        },
        beforeOpen: (details) async {
          await customStatement('PRAGMA foreign_keys = OFF');
          // A unit left `downloading` by a killed app is not downloading.
          if (!details.wasCreated) await downloadStateDao.resetInterrupted();
        },
      );
}
