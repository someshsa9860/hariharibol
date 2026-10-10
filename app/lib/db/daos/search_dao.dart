import 'package:drift/drift.dart';

import '../app_database.dart';
import '../tables.dart';

part 'search_dao.g.dart';

/// One full-text hit: the verse, the language the text matched in, and the
/// matching passage with the terms in `[brackets]`.
class SearchHit {
  const SearchHit({required this.verseRowId, required this.language, required this.snippet});

  final String verseRowId;

  /// A language code, or [SearchDao.sourceText] when the Sanskrit matched.
  final String language;
  final String snippet;
}

/// Full-text search over everything on the device, with SQLite FTS5.
///
/// The index holds one row per verse per language (translation, meaning and
/// purport together) plus one for the Sanskrit and transliteration. It is
/// written by `BookDao.replaceUnit` inside the same transaction as the verses,
/// so it can never describe a unit that is half there.
@DriftAccessor(tables: [Verses, VerseTranslations])
class SearchDao extends DatabaseAccessor<AppDatabase> with _$SearchDaoMixin {
  SearchDao(super.db);

  /// The `language` value of the row holding Sanskrit and transliteration.
  static const String sourceText = '';

  Future<void> createIndex() => customStatement(
        'CREATE VIRTUAL TABLE IF NOT EXISTS verse_fts USING fts5('
        'verse_row_id UNINDEXED, book_id UNINDEXED, unit_id UNINDEXED, language UNINDEXED, body, '
        "tokenize = 'unicode61 remove_diacritics 2')",
      );

  /// Removes a unit's rows. Call before replacing its verses.
  Future<void> removeUnit(String unitId) =>
      customStatement('DELETE FROM verse_fts WHERE unit_id = ?', [unitId]);

  /// Adds rows for [entries] in one batch.
  Future<void> addAll(List<FtsEntry> entries) async {
    if (entries.isEmpty) return;
    await batch((b) {
      for (final e in entries) {
        b.customStatement(
          'INSERT INTO verse_fts(verse_row_id, book_id, unit_id, language, body) VALUES (?, ?, ?, ?, ?)',
          [e.verseRowId, e.bookId, e.unitId, e.language, e.body],
        );
      }
    });
  }

  /// Turns what someone typed into an FTS5 query: every word must match, the
  /// last as a prefix (they are still typing it). Punctuation and FTS syntax
  /// are stripped rather than escaped — a search box is not a query language.
  static String? toMatchQuery(String input) {
    final words = RegExp(r'[\p{L}\p{M}\p{N}]+', unicode: true).allMatches(input).map((m) => m.group(0)!).toList();
    if (words.isEmpty) return null;
    return [
      for (var i = 0; i < words.length; i++) '"${words[i]}"${i == words.length - 1 ? '*' : ''}',
    ].join(' ');
  }

  /// Best matches first. [languages] limits which renderings are searched
  /// (pass the reader's chain; [sourceText] is always included); [bookId]
  /// limits to one book.
  Future<List<SearchHit>> search(
    String input, {
    List<String>? languages,
    String? bookId,
    int limit = 30,
  }) async {
    final match = toMatchQuery(input);
    if (match == null) return const [];

    final where = <String>['verse_fts MATCH ?'];
    final args = <Variable>[Variable<String>(match)];
    if (bookId != null) {
      where.add('book_id = ?');
      args.add(Variable<String>(bookId));
    }
    if (languages != null) {
      final all = {sourceText, ...languages};
      where.add('language IN (${List.filled(all.length, '?').join(', ')})');
      args.addAll(all.map(Variable<String>.new));
    }
    args.add(Variable<int>(limit));

    final rows = await customSelect(
      "SELECT verse_row_id, language, snippet(verse_fts, 4, '[', ']', '…', 14) AS snippet "
      'FROM verse_fts WHERE ${where.join(' AND ')} ORDER BY rank LIMIT ?',
      variables: args,
    ).get();

    return [
      for (final row in rows)
        SearchHit(
          verseRowId: row.read<String>('verse_row_id'),
          language: row.read<String>('language'),
          snippet: row.read<String>('snippet'),
        ),
    ];
  }
}

class FtsEntry {
  const FtsEntry({
    required this.verseRowId,
    required this.bookId,
    required this.unitId,
    required this.language,
    required this.body,
  });

  final String verseRowId;
  final String bookId;
  final String unitId;
  final String language;
  final String body;
}
