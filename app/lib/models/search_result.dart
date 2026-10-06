import 'book.dart';
import 'json.dart';
import 'mantra.dart';
import 'verse.dart';

/// What a search is narrowed to — a "see all" from the overview, or the kind
/// a lazy-loaded results screen keeps paging through.
enum SearchScope {
  verse('verse'),
  mantra('mantra'),
  book('book');

  const SearchScope(this.wire);

  final String wire;
}

/// The quick, unpaginated preview across all three kinds — what a query first
/// lands on, before the reader opens one kind's full list.
class SearchOverview {
  const SearchOverview({
    required this.query,
    this.verses = const [],
    this.verseHasMore = false,
    this.mantras = const [],
    this.mantraHasMore = false,
    this.books = const [],
    this.bookHasMore = false,
  });

  final String query;
  final List<Verse> verses;
  final bool verseHasMore;
  final List<Mantra> mantras;
  final bool mantraHasMore;
  final List<Book> books;
  final bool bookHasMore;

  bool get isEmpty => verses.isEmpty && mantras.isEmpty && books.isEmpty;

  factory SearchOverview.fromJson(Json json) => SearchOverview(
        query: asString(json['query']),
        verses: asList(json['verses'], Verse.fromJson),
        verseHasMore: asBool(json['verseHasMore']),
        mantras: asList(json['mantras'], Mantra.fromJson),
        mantraHasMore: asBool(json['mantraHasMore']),
        books: asList(json['books'], Book.fromJson),
        bookHasMore: asBool(json['bookHasMore']),
      );
}
