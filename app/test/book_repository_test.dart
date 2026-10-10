import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/db/app_database.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/book.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/repositories/book_repository.dart';
import 'package:hariharibol/services/book_service.dart';
import 'package:hariharibol/services/book_sync_manager.dart';

import 'support/book_fixtures.dart';
import 'support/fakes_sync.dart';

class FakeBookService implements BookService {
  ChapterReading? chapterResult;
  Object? chapterError;
  int chapterCalls = 0;
  List<Verse>? versesResult;
  Object? versesError;

  @override
  Future<ChapterReading> chapter(String slug, int number, {int? canto}) async {
    chapterCalls++;
    if (chapterError != null) throw chapterError!;
    return chapterResult!;
  }

  @override
  Future<List<Verse>> verses(String slug) async {
    if (versesError != null) throw versesError!;
    return versesResult!;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late AppDatabase db;
  late FakeCacheApi api;
  late FakeDownloader downloader;
  late BookSyncManager sync;
  late FakeBookService service;
  late BookRepository repo;

  setUpAll(() => driftRuntimeOptions.dontWarnAboutMultipleDatabases = true);

  setUp(() {
    db = memoryDb();
    api = FakeCacheApi([manifestUnit(1), manifestUnit(2)]);
    downloader = FakeDownloader();
    sync = BookSyncManager(db: db, api: api, downloader: downloader, conditions: FakeConditions());
    service = FakeBookService();
    repo = BookRepository(db: db, sync: sync, api: service);
  });

  tearDown(() async {
    await sync.idle(); // the silent sync a read starts must finish before the database goes
    await sync.dispose();
    await db.close();
  });

  Future<void> store(int cantoNumber) async {
    await db.bookDao.replaceUnit(
      payloadOf(unitJson(unitId: 'canto$cantoNumber', unitNumber: cantoNumber)),
      version: 1,
      hash: 'h$cantoNumber',
    );
  }

  test('a downloaded chapter is read from the device without touching the network', () async {
    await store(1);
    final reading = await repo.chapter('srimad-bhagavatam', 1, canto: 1, chain: ['en']);

    expect(service.chapterCalls, 0);
    expect(reading.chapter.title, 'Chapter 1');
    expect(reading.verses.map((v) => v.verseNumber), [1, 2]);
    expect(reading.verses.first.sanskrit, 'श्लोक 1.1');
    expect(reading.verses.first.translation?.meaning, 'english meaning 1.1');
    expect(reading.verses.first.translation?.purport, 'purport english 1.1');
    expect(reading.verses.first.translation?.translator?.name, 'Prabhupada');
    expect(reading.verses.first.wordMeaningsText, 'om — O my Lord');
    expect(reading.verses.first.audioPath, isNotNull);
    expect(reading.verses.first.hasAudio, isTrue);
    expect(reading.verses[1].hasAudio, isFalse);
    expect(reading.verses.first.book?.slug, 'srimad-bhagavatam');
  });

  test('the reading language picks the rendering; the others stay on the device', () async {
    await store(1);
    final hindi = await repo.chapter('srimad-bhagavatam', 1, canto: 1, chain: ['hi', 'en']);
    expect(hindi.verses.first.translation?.meaning, 'हिंदी अर्थ 1.1');
    expect(hindi.chapter.title, 'अध्याय 1');

    final english = await repo.chapter('srimad-bhagavatam', 1, canto: 1, chain: ['en']);
    expect(english.verses.first.translation?.meaning, 'english meaning 1.1');
    expect(english.chapter.title, 'Chapter 1');
  });

  test('a language with no rendering falls back along the chain', () async {
    await store(1);
    final reading = await repo.chapter('srimad-bhagavatam', 1, canto: 1, chain: ['ta', 'hi', 'en']);
    expect(reading.verses.first.translation?.languageCode, 'hi');
  });

  test('the Sanskrit is there whatever the reading language', () async {
    await store(1);
    final reading = await repo.chapter('srimad-bhagavatam', 1, canto: 1, chain: ['xx']);
    expect(reading.verses.first.sanskrit, isNotNull);
    expect(reading.verses.first.translation, isNull);
  });

  test('opening a chapter nudges the book sync with the canto being read', () async {
    await store(1);
    await repo.chapter('srimad-bhagavatam', 1, canto: 1, chain: ['en']);
    await sync.idle();
    expect(downloader.started, contains('canto2'), reason: 'the rest of the book follows silently');
  });

  test('a chapter that is not downloaded is fetched at high priority, then read locally', () async {
    final reading = await repo.chapter('srimad-bhagavatam', 2, canto: 2, chain: ['en']);
    expect(downloader.started.first, 'canto2');
    expect(service.chapterCalls, 0);
    expect(reading.verses, isNotEmpty);
  });

  test('when the unit cannot be downloaded the API is used', () async {
    downloader.failure = (_) => Exception('nope');
    service.chapterResult = const ChapterReading(chapter: BookSection(id: 'api', number: 5, title: 'From API'), verses: []);
    final reading = await repo.chapter('srimad-bhagavatam', 5, canto: 5, chain: ['en']);
    expect(reading.chapter.title, 'From API');
    expect(service.chapterCalls, 1);
  });

  test('offline and not downloaded is the API\'s failure, not a silent empty page', () async {
    api.manifestError = const ApiFailure(kind: FailureKind.network);
    service.chapterError = const ApiFailure(kind: FailureKind.network);
    await expectLater(repo.chapter('srimad-bhagavatam', 5, canto: 5, chain: ['en']), throwsA(isA<ApiFailure>()));
  });

  test('cantos and chapters can be listed from the device', () async {
    await store(1);
    final cantos = await repo.cantosLocal('srimad-bhagavatam', chain: ['en']);
    expect(cantos!.map((c) => c.number), [1]);
    expect(cantos.first.totalChapters, 2);

    final chapters = await repo.chaptersLocal('srimad-bhagavatam', canto: 1, chain: ['en']);
    expect(chapters!.map((c) => c.number), [1, 2]);
    expect(await repo.chaptersLocal('srimad-bhagavatam', canto: 9, chain: ['en']), isNull);
    expect(await repo.cantosLocal('unknown', chain: ['en']), isNull);
  });

  test('search finds a verse across languages and returns it as a Verse', () async {
    await store(1);
    final results = await repo.search('purport', chain: ['en']);
    expect(results, isNotEmpty);
    expect(results.first.verse.book?.slug, 'srimad-bhagavatam');
    expect(results.first.snippet, contains('['));
    expect(results.map((r) => r.verse.id).toSet(), hasLength(results.length), reason: 'one result per verse');
    expect(await repo.search('purport', chain: ['en'], bookSlug: 'nope'), isEmpty);
  });

  group('short works', () {
    Verse apiVerse(int n) => Verse(
          id: 'sv$n',
          verseId: '7.$n',
          bookNumber: 7,
          type: 'SHLOKA',
          verseNumber: n,
          sanskrit: 'ॐ $n',
          wordMeanings: const [WordMeaning(word: 'om', meaning: 'the sound')],
          audioUrl: 'https://cdn.test/a$n.mp3',
          book: const VerseBookRef(id: 'short1', slug: 'aarti', title: 'Aarti', bookNumber: 7),
          translation: VerseTranslation(
            id: 'tr$n',
            languageCode: 'en',
            type: 'TRANSLATION',
            meaning: 'meaning $n',
            translator: const Translator(id: 'x', slug: 'x', name: 'X'),
          ),
        );

    test('served from the API and saved as they arrive', () async {
      service.versesResult = [apiVerse(1), apiVerse(2)];
      final verses = await repo.shortWork('aarti', chain: ['en']);
      expect(verses, hasLength(2));
      await pumpEventQueue();
      await Future<void>.delayed(const Duration(milliseconds: 100));

      expect((await repo.shortWorkLocal('aarti', chain: ['en']))!.map((v) => v.verseNumber), [1, 2]);
    });

    test('read from the device when the API cannot be reached', () async {
      await repo.saveShortWork([apiVerse(1), apiVerse(2)]);
      service.versesError = const ApiFailure(kind: FailureKind.network);

      final verses = await repo.shortWork('aarti', chain: ['en']);
      expect(verses.first.translation?.meaning, 'meaning 1');
      expect(verses.first.audioUrl, 'https://cdn.test/a1.mp3');
      expect(verses.first.wordMeanings.single.word, 'om');
    });

    test('with nothing saved, the API failure is reported', () async {
      service.versesError = const ApiFailure(kind: FailureKind.network);
      await expectLater(repo.shortWork('aarti', chain: ['en']), throwsA(isA<ApiFailure>()));
    });

    test('saving again replaces the whole work', () async {
      await repo.saveShortWork([apiVerse(1), apiVerse(2)]);
      await repo.saveShortWork([apiVerse(1)]);
      expect(await repo.shortWorkLocal('aarti', chain: ['en']), hasLength(1));
    });
  });
}
