import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/db/app_database.dart';
import 'package:hariharibol/db/tables.dart';

import 'support/book_fixtures.dart';

void main() {
  late AppDatabase db;

  setUpAll(() => driftRuntimeOptions.dontWarnAboutMultipleDatabases = true);

  setUp(() => db = memoryDb());
  tearDown(() => db.close());

  Future<void> save(Map<String, dynamic> json, {int version = 1, String hash = 'h1'}) =>
      db.bookDao.replaceUnit(payloadOf(json), version: version, hash: hash, totalUnits: 3);

  test('a unit is stored with its chapters, verses and every language', () async {
    await save(unitJson());

    final book = await db.bookDao.bookBySlug('srimad-bhagavatam');
    expect(book?.unitType, 'canto');
    expect(book?.totalUnits, 3);

    final cantos = await db.bookDao.sections('book1', 'canto');
    final chapters = await db.bookDao.sections('book1', 'chapter', cantoNumber: 1);
    expect(cantos.map((c) => c.number), [1]);
    expect(chapters.map((c) => c.number), [1, 2]);
    expect(chapters.every((c) => c.downloadUnitId == 'canto1'), isTrue);

    final verses = await db.bookDao.versesOfChapter('ch1-1');
    expect(verses.map((v) => v.verseNumber), [1, 2]);
    expect(verses.first.sanskrit, 'श्लोक 1.1');

    final translations = await db.bookDao.translationsFor(verses.map((v) => v.id));
    expect(translations[verses.first.id]!.map((t) => t.languageCode).toSet(), {'en', 'hi'});
  });

  test('download_state is done at the downloaded version and hash', () async {
    await save(unitJson(), version: 4, hash: 'abc');
    final state = await db.downloadStateDao.stateOf('book1', 'canto1');
    expect(UnitStatus.parse(state!.status), UnitStatus.done);
    expect(state.version, 4);
    expect(state.hash, 'abc');
    expect(state.downloadedAt, isNotNull);
    expect(state.retryCount, 0);
  });

  test('replacing a unit removes its old verses, translations and search rows', () async {
    await save(unitJson(chapters: [1, 2]));
    await save(unitJson(chapters: [1], purportPrefix: 'revised'), version: 2, hash: 'h2');

    expect((await db.bookDao.sections('book1', 'chapter')).map((c) => c.number), [1]);
    expect(await db.bookDao.versesOfChapter('ch1-2'), isEmpty);
    expect(await db.select(db.verseTranslations).get(), hasLength(4)); // 2 verses x 2 languages

    final old = await db.searchDao.search('purport');
    expect(old, isEmpty);
    final fresh = await db.searchDao.search('revised');
    expect(fresh, isNotEmpty);
  });

  test('other units are untouched when one is replaced', () async {
    await save(unitJson(unitId: 'canto1', unitNumber: 1));
    await save(unitJson(unitId: 'canto2', unitNumber: 2), hash: 'h2');
    await save(unitJson(unitId: 'canto1', unitNumber: 1, purportPrefix: 'again'), version: 2, hash: 'h3');

    expect((await db.bookDao.sections('book1', 'canto')).map((c) => c.number), [1, 2]);
    expect(await db.bookDao.versesOfChapter('ch2-1'), isNotEmpty);
  });

  test('a failure part-way leaves the previous copy, not half of the new one', () async {
    await save(unitJson(), version: 1, hash: 'good');

    // Same verse id twice makes the INSERT ... fail? InsertOrReplace would hide
    // that, so poison it differently: a payload whose book id is missing from a
    // NOT NULL column cannot be built — force the failure with a thrown error
    // from inside the transaction instead.
    final broken = payloadOf(unitJson(purportPrefix: 'broken'));
    await expectLater(
      db.transaction(() async {
        await db.bookDao.replaceUnit(broken, version: 2, hash: 'bad');
        throw StateError('boom after the replace');
      }),
      throwsStateError,
    );

    final state = await db.downloadStateDao.stateOf('book1', 'canto1');
    expect(state!.version, 1);
    expect(state.hash, 'good');
    final rows = await db.bookDao.translationsFor((await db.bookDao.versesOfChapter('ch1-1')).map((v) => v.id));
    expect(rows.values.first.first.purport, isNot(contains('broken')));
  });

  test('summary counts statuses against the manifest total', () async {
    await save(unitJson(unitId: 'canto1', unitNumber: 1));
    await db.downloadStateDao.markPending(bookId: 'book1', unitId: 'canto2', unitType: 'canto', unitNumber: 2);
    await db.downloadStateDao.markPending(bookId: 'book1', unitId: 'canto3', unitType: 'canto', unitNumber: 3);
    await db.downloadStateDao.markDownloading('book1', 'canto2');
    await db.downloadStateDao.markFailed('book1', 'canto3', 'offline');

    final s = await db.downloadStateDao.summary('book1');
    expect((s.total, s.downloaded, s.downloading, s.failed, s.pending), (3, 1, 1, 1, 0));
    expect(s.isComplete, isFalse);

    final failed = await db.downloadStateDao.stateOf('book1', 'canto3');
    expect(failed!.retryCount, 1);
    expect(failed.lastError, 'offline');
  });

  test('a unit that is already done keeps its version when marked pending again', () async {
    await save(unitJson(), version: 3, hash: 'h');
    await db.downloadStateDao.markPending(bookId: 'book1', unitId: 'canto1', unitType: 'canto', unitNumber: 1);
    final state = await db.downloadStateDao.stateOf('book1', 'canto1');
    expect(UnitStatus.parse(state!.status), UnitStatus.done);
    expect(state.version, 3);
  });

  test('resetInterrupted turns downloading back into pending', () async {
    await db.downloadStateDao.markPending(bookId: 'b', unitId: 'u', unitType: 'chapter', unitNumber: 1);
    await db.downloadStateDao.markDownloading('b', 'u');
    await db.downloadStateDao.resetInterrupted();
    expect(UnitStatus.parse((await db.downloadStateDao.stateOf('b', 'u'))!.status), UnitStatus.pending);
  });

  test('unfinished skips done units and failures past the retry limit', () async {
    await save(unitJson(unitId: 'done1', unitNumber: 1));
    for (final id in ['p', 'f1', 'f9']) {
      await db.downloadStateDao.markPending(bookId: 'book1', unitId: id, unitType: 'canto', unitNumber: 5);
    }
    await db.downloadStateDao.markFailed('book1', 'f1', 'x');
    for (var i = 0; i < 9; i++) {
      await db.downloadStateDao.markFailed('book1', 'f9', 'x');
    }
    final owed = await db.downloadStateDao.unfinished(retryLimit: 5);
    expect(owed.map((s) => s.unitId).toSet(), {'p', 'f1'});
  });

  group('full-text search', () {
    setUp(() => save(unitJson()));

    test('finds a purport by a word in it, with a snippet', () async {
      final hits = await db.searchDao.search('english meaning');
      expect(hits, isNotEmpty);
      expect(hits.first.snippet, contains('['));
      expect(hits.first.language, 'en');
    });

    test('a prefix of the last word matches', () async {
      expect(await db.searchDao.search('purp'), isNotEmpty);
    });

    test('finds Sanskrit and Devanagari translations', () async {
      expect(await db.searchDao.search('श्लोक'), isNotEmpty);
      expect(await db.searchDao.search('हिंदी'), isNotEmpty);
    });

    test('limits to the languages asked for', () async {
      final hi = await db.searchDao.search('meaning', languages: ['hi']);
      expect(hi, isEmpty); // the Hindi text says अर्थ, not "meaning"
      final en = await db.searchDao.search('meaning', languages: ['en']);
      expect(en, isNotEmpty);
    });

    test('limits to a book', () async {
      expect(await db.searchDao.search('purport', bookId: 'other'), isEmpty);
      expect(await db.searchDao.search('purport', bookId: 'book1'), isNotEmpty);
    });

    test('punctuation and FTS syntax in the query are harmless', () async {
      expect(await db.searchDao.search('"purport" ( * ) --'), isNotEmpty);
      expect(await db.searchDao.search('  !!! '), isEmpty);
    });
  });

  test('upgrading a version 1 database drops the old tables and creates the new ones', () async {
    final raw = NativeDatabase.memory(setup: (sqlite) {
      sqlite.execute('CREATE TABLE downloaded_books (id TEXT PRIMARY KEY, slug TEXT, title TEXT, book_number INT)');
      sqlite.execute('CREATE TABLE downloaded_verses (id TEXT PRIMARY KEY)');
      sqlite.execute('CREATE TABLE book_downloads (book_id TEXT, language_code TEXT)');
      sqlite.execute("INSERT INTO downloaded_books VALUES ('b', 's', 't', 1)");
      sqlite.execute('PRAGMA user_version = 1');
    });
    final upgraded = AppDatabase(raw);
    addTearDown(upgraded.close);

    await upgraded.bookDao.replaceUnit(payloadOf(unitJson()), version: 1, hash: 'h');

    final tables = await upgraded
        .customSelect("SELECT name FROM sqlite_master WHERE type IN ('table')")
        .map((r) => r.read<String>('name'))
        .get();
    expect(tables, containsAll(['books', 'units', 'verses', 'verse_translations', 'download_state', 'verse_fts']));
    expect(tables, isNot(contains('downloaded_books')));
    expect(tables, isNot(contains('book_downloads')));
    expect(await upgraded.searchDao.search('purport'), isNotEmpty);
  });

  group('book cache version', () {
    Future<void> saveAt(int cacheVersion, {String bookId = 'book1', String unitId = 'canto1', int number = 1}) =>
        db.bookDao.replaceUnit(
          payloadOf(unitJson(bookId: bookId, unitId: unitId, unitNumber: number)),
          version: 1,
          hash: 'h$number',
          cacheVersion: cacheVersion,
        );

    Future<int> count(String table) async =>
        (await db.customSelect('SELECT COUNT(*) AS n FROM $table').getSingle()).read<int>('n');

    test('a unit remembers the version it was saved under; the default is the baseline, 1', () async {
      await save(unitJson());
      expect((await db.downloadStateDao.stateOf('book1', 'canto1'))!.cacheVersion, 1);
      await saveAt(6);
      expect((await db.downloadStateDao.stateOf('book1', 'canto1'))!.cacheVersion, 6);
    });

    test('dropOutdatedUnits removes the verses, translations, search rows and state of other versions', () async {
      await saveAt(1);
      expect(await db.searchDao.search('purport'), isNotEmpty);

      expect(await db.bookDao.dropOutdatedUnits('book1', 2), 1);

      expect(await db.downloadStateDao.stateOf('book1', 'canto1'), isNull);
      expect(await count('verses'), 0);
      expect(await count('verse_translations'), 0);
      expect(await count('units'), 0);
      expect(await db.searchDao.search('purport'), isEmpty);
    });

    test('a unit already at the version is kept, a stale one next to it is not', () async {
      await saveAt(2, unitId: 'canto1', number: 1);
      await saveAt(1, unitId: 'canto2', number: 2);

      expect(await db.bookDao.dropOutdatedUnits('book1', 2), 1);

      expect(await db.downloadStateDao.stateOf('book1', 'canto1'), isNotNull);
      expect(await db.downloadStateDao.stateOf('book1', 'canto2'), isNull);
      expect(await db.bookDao.versesOfChapter('ch1-1'), isNotEmpty);
      expect(await db.bookDao.versesOfChapter('ch2-1'), isEmpty);
    });

    test('nothing to drop at the same version', () async {
      await saveAt(3);
      expect(await db.bookDao.dropOutdatedUnits('book1', 3), 0);
      expect(await db.bookDao.versesOfChapter('ch1-1'), isNotEmpty);
    });

    test('another book is not touched', () async {
      await saveAt(1, bookId: 'book1');
      await db.bookDao.replaceUnit(
        payloadOf(unitJson(bookId: 'book2', bookSlug: 'other', unitId: 'chapterX', unitType: 'chapter', unitNumber: 1, chapters: const [1])),
        version: 1,
        hash: 'h',
      );

      expect(await db.bookDao.dropOutdatedUnits('book1', 2), 1);
      expect(await db.downloadStateDao.stateOf('book2', 'chapterX'), isNotNull);
      expect(await db.bookDao.versesOfChapter('chapterX'), isNotEmpty);
    });

    test('a short work, saved whole from the API, has no state row and is kept', () async {
      await db.bookDao.replaceUnit(
        payloadOf(unitJson(bookId: 'book1', unitType: 'book', unitId: 'short:book1', unitNumber: 0, chapters: const [1])),
        version: 0,
        hash: '',
      );
      expect(await db.bookDao.dropOutdatedUnits('book1', 9), 0);
      expect(await count('verses'), greaterThan(0));
    });

    test('upgrading a version 2 database keeps its rows and counts them as version 1', () async {
      final raw = NativeDatabase.memory(setup: (sqlite) {
        sqlite.execute('''
          CREATE TABLE download_state (
            book_id TEXT NOT NULL, unit_id TEXT NOT NULL, unit_type TEXT NOT NULL,
            unit_number INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
            version INTEGER NOT NULL DEFAULT 0, hash TEXT, downloaded_at INTEGER,
            retry_count INTEGER NOT NULL DEFAULT 0, last_error TEXT,
            PRIMARY KEY (book_id, unit_id))
        ''');
        sqlite.execute("INSERT INTO download_state (book_id, unit_id, unit_type, unit_number, status, version, hash) VALUES ('b', 'u', 'canto', 4, 'done', 7, 'abc')");
        sqlite.execute('PRAGMA user_version = 2');
      });
      final upgraded = AppDatabase(raw);
      addTearDown(upgraded.close);

      final state = await upgraded.downloadStateDao.stateOf('b', 'u');
      expect((state!.version, state.hash, state.cacheVersion), (7, 'abc', 1));
      // So a server still on version 1 does not make every phone download again.
      expect(await upgraded.bookDao.dropOutdatedUnits('b', 1), 0);
      expect(await upgraded.downloadStateDao.stateOf('b', 'u'), isNotNull);
    });
  });

  test('indexes exist for unit and language lookups', () async {
    final names = await db
        .customSelect("SELECT name FROM sqlite_master WHERE type = 'index'")
        .map((r) => r.read<String>('name'))
        .get();
    expect(names, containsAll(['verses_by_unit', 'translations_by_verse_language', 'translations_by_language']));
  });
}
