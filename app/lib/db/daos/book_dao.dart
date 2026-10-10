import 'dart:convert';

import 'package:drift/drift.dart';

import '../../models/book_cache.dart';
import '../app_database.dart';
import '../tables.dart';
import 'search_dao.dart';

part 'book_dao.g.dart';

/// Reads and writes the library. Every write of book text goes through
/// [replaceUnit] — one transaction per unit — so there is never a half-updated
/// chapter on the device: either the old copy, or the new one.
@DriftAccessor(tables: [Books, Units, Verses, VerseTranslations, DownloadStates])
class BookDao extends DatabaseAccessor<AppDatabase> with _$BookDaoMixin {
  BookDao(super.db);

  /// The `unitId` a short work's verses carry. A short work is not cut into
  /// downloadable units; it is saved whole from the API under this id.
  static String shortWorkUnitId(String bookId) => 'short:$bookId';

  // ── Writing ──────────────────────────────────────────────────────────

  /// Replaces everything of one unit with [payload], atomically: the old verses
  /// and their translations and search rows are deleted and the new ones
  /// inserted in one transaction, and — for a real download unit — its
  /// `download_state` is set to `done` at [version] and [hash] in that same
  /// transaction. If anything throws, none of it happened.
  Future<void> replaceUnit(
    UnitPayload payload, {
    required int version,
    required String hash,
    int? totalUnits,
  }) {
    return transaction(() async {
      final unitId = payload.unit.id;
      final isBookUnit = payload.unitType == 'book';

      // Old rows out, children before parents.
      await db.searchDao.removeUnit(unitId);
      await customUpdate(
        'DELETE FROM verse_translations WHERE verse_row_id IN (SELECT id FROM verses WHERE unit_id = ?)',
        variables: [Variable<String>(unitId)],
        updates: {verseTranslations},
        updateKind: UpdateKind.delete,
      );
      await (delete(verses)..where((v) => v.unitId.equals(unitId))).go();
      await (delete(units)..where((u) => u.downloadUnitId.equals(unitId))).go();

      await _upsertBook(payload, totalUnits: totalUnits);

      final unitRows = <UnitsCompanion>[];
      if (!isBookUnit) {
        final chapterIds = payload.chapters.map((c) => c.id).toSet();
        if (!chapterIds.contains(payload.unit.id)) {
          unitRows.add(_unitRow(payload, payload.unit, kind: payload.unitType));
        }
        for (final chapter in payload.chapters) {
          unitRows.add(_unitRow(
            payload,
            chapter,
            kind: 'chapter',
            cantoNumber: chapter.cantoNumber ?? (payload.unitType == 'canto' ? payload.unit.number : null),
          ));
        }
      }

      final verseRows = <VersesCompanion>[];
      final translationRows = <VerseTranslationsCompanion>[];
      final ftsRows = <FtsEntry>[];

      for (final verse in payload.verses) {
        verseRows.add(VersesCompanion.insert(
          id: verse.id,
          verseId: verse.verseId,
          bookId: payload.bookId,
          unitId: unitId,
          chapterId: Value(verse.chapterId),
          cantoNumber: Value(verse.cantoNumber),
          chapterNumber: Value(verse.chapterNumber),
          verseNumber: verse.verseNumber,
          verseNumberEnd: Value(verse.verseNumberEnd),
          type: Value(verse.type),
          sanskrit: Value(verse.sanskrit),
          transliteration: Value(verse.transliteration),
          wordMeanings: Value(verse.wordMeaningsJson),
          audioPath: Value(verse.audioPath),
          audioUrl: Value(verse.audioUrl),
          tagsJson: Value(verse.tags.isEmpty ? null : jsonEncode(verse.tags)),
        ));

        final byLanguage = <String, StringBuffer>{};
        for (final t in verse.translations) {
          translationRows.add(VerseTranslationsCompanion.insert(
            id: t.id,
            verseRowId: verse.id,
            languageCode: t.languageCode,
            type: Value(t.type),
            translatorId: Value(t.translatorId),
            translatorSlug: Value(t.translatorSlug),
            translatorName: Value(t.translatorName),
            meaning: Value(t.meaning),
            purport: Value(t.purport),
            sourceRef: Value(t.sourceRef),
            audioPath: Value(t.audioPath),
            displayOrder: Value(t.displayOrder),
          ));
          (byLanguage[t.languageCode] ??= StringBuffer())
            ..write(t.meaning ?? '')
            ..write(' ')
            ..write(t.purport ?? '')
            ..write(' ');
        }

        final source = [verse.sanskrit, verse.transliteration, _plainWords(verse.wordMeaningsJson)]
            .whereType<String>()
            .join(' ')
            .trim();
        if (source.isNotEmpty) {
          ftsRows.add(FtsEntry(
            verseRowId: verse.id,
            bookId: payload.bookId,
            unitId: unitId,
            language: SearchDao.sourceText,
            body: source,
          ));
        }
        byLanguage.forEach((language, text) {
          final body = text.toString().trim();
          if (body.isNotEmpty) {
            ftsRows.add(FtsEntry(
              verseRowId: verse.id,
              bookId: payload.bookId,
              unitId: unitId,
              language: language,
              body: body,
            ));
          }
        });
      }

      await batch((b) {
        b.insertAll(units, unitRows, mode: InsertMode.insertOrReplace);
        b.insertAll(verses, verseRows, mode: InsertMode.insertOrReplace);
        b.insertAll(verseTranslations, translationRows, mode: InsertMode.insertOrReplace);
      });
      await db.searchDao.addAll(ftsRows);

      if (!isBookUnit) {
        await into(downloadStates).insertOnConflictUpdate(
          DownloadStatesCompanion.insert(
            bookId: payload.bookId,
            unitId: unitId,
            unitType: payload.unitType,
            unitNumber: Value(payload.unit.number),
            status: Value(UnitStatus.done.name),
            version: Value(version),
            hash: Value(hash),
            downloadedAt: Value(DateTime.now()),
            retryCount: const Value(0),
            lastError: const Value(null),
          ),
        );
      }
    });
  }

  Future<void> _upsertBook(UnitPayload payload, {int? totalUnits}) async {
    final existing = await (select(books)..where((b) => b.id.equals(payload.bookId))).getSingleOrNull();
    final isBookUnit = payload.unitType == 'book';
    await into(books).insertOnConflictUpdate(
      BooksCompanion.insert(
        id: payload.bookId,
        slug: payload.bookSlug,
        title: payload.bookTitle,
        titleI18n: Value(payload.bookTitleI18n == null ? null : jsonEncode(payload.bookTitleI18n)),
        bookNumber: payload.bookNumber,
        unitType: Value(isBookUnit ? null : payload.unitType),
        totalUnits: Value(totalUnits ?? existing?.totalUnits ?? 0),
        updatedAt: DateTime.now(),
      ),
    );
  }

  UnitsCompanion _unitRow(UnitPayload payload, PayloadSection section, {required String kind, int? cantoNumber}) {
    return UnitsCompanion.insert(
      id: section.id,
      bookId: payload.bookId,
      kind: kind,
      number: section.number,
      cantoNumber: Value(cantoNumber),
      downloadUnitId: payload.unit.id,
      title: section.title,
      titleI18n: Value(section.titleI18n == null ? null : jsonEncode(section.titleI18n)),
      summary: Value(section.summary),
      summaryI18n: Value(section.summaryI18n == null ? null : jsonEncode(section.summaryI18n)),
      totalVerses: Value(section.totalVerses),
    );
  }

  /// "om—O my Lord; …" for the search index, from the stored JSON list.
  String? _plainWords(String? json) {
    if (json == null) return null;
    try {
      final list = jsonDecode(json) as List;
      return list
          .whereType<Map>()
          .map((m) => '${m['word'] ?? ''} ${m['meaning'] ?? ''}')
          .join(' ');
    } catch (_) {
      return null;
    }
  }

  Future<void> setTotalUnits(String bookId, int total) async {
    await (update(books)..where((b) => b.id.equals(bookId))).write(BooksCompanion(totalUnits: Value(total)));
  }

  // ── Reading ──────────────────────────────────────────────────────────

  Future<BookRecord?> bookBySlug(String slug) =>
      (select(books)..where((b) => b.slug.equals(slug))).getSingleOrNull();

  Future<BookRecord?> bookById(String id) => (select(books)..where((b) => b.id.equals(id))).getSingleOrNull();

  /// Cantos, or chapters ([cantoNumber] narrows chapters to one canto).
  Future<List<UnitRecord>> sections(String bookId, String kind, {int? cantoNumber}) {
    final query = select(units)
      ..where((u) => u.bookId.equals(bookId) & u.kind.equals(kind))
      ..orderBy([(u) => OrderingTerm.asc(u.cantoNumber), (u) => OrderingTerm.asc(u.number)]);
    if (cantoNumber != null) query.where((u) => u.cantoNumber.equals(cantoNumber));
    return query.get();
  }

  Future<UnitRecord?> chapter(String bookId, int number, {int? cantoNumber}) {
    final query = select(units)..where((u) => u.bookId.equals(bookId) & u.kind.equals('chapter') & u.number.equals(number));
    if (cantoNumber != null) query.where((u) => u.cantoNumber.equals(cantoNumber));
    return query.getSingleOrNull();
  }

  Future<List<VerseRecord>> versesOfChapter(String chapterId) =>
      (select(verses)
            ..where((v) => v.chapterId.equals(chapterId))
            ..orderBy([(v) => OrderingTerm.asc(v.verseNumber), (v) => OrderingTerm.asc(v.id)]))
          .get();

  Future<List<VerseRecord>> shortWorkVerses(String bookId) =>
      (select(verses)
            ..where((v) => v.bookId.equals(bookId) & v.unitId.equals(shortWorkUnitId(bookId)))
            ..orderBy([(v) => OrderingTerm.asc(v.verseNumber), (v) => OrderingTerm.asc(v.id)]))
          .get();

  Future<VerseRecord?> verseByRowId(String id) =>
      (select(verses)..where((v) => v.id.equals(id))).getSingleOrNull();

  /// Every stored rendering of [verseRowIds], grouped by verse and in display
  /// order. Chunked: a chapter is a few hundred verses, a canto a few thousand,
  /// and SQLite caps the variables in one statement.
  Future<Map<String, List<TranslationRecord>>> translationsFor(Iterable<String> verseRowIds) async {
    final ids = verseRowIds.toList();
    final out = <String, List<TranslationRecord>>{};
    for (var i = 0; i < ids.length; i += 500) {
      final chunk = ids.sublist(i, i + 500 > ids.length ? ids.length : i + 500);
      final rows = await (select(verseTranslations)
            ..where((t) => t.verseRowId.isIn(chunk))
            ..orderBy([(t) => OrderingTerm.asc(t.displayOrder), (t) => OrderingTerm.asc(t.id)]))
          .get();
      for (final row in rows) {
        (out[row.verseRowId] ??= []).add(row);
      }
    }
    return out;
  }
}
