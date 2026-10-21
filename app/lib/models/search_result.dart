import 'book.dart';
import 'json.dart';
import 'mantra.dart';
import 'verse.dart';

/// What a search is narrowed to — a "see all" from the overview, or the kind
/// a lazy-loaded results list keeps paging through.
enum SearchScope {
  verse('verse'),
  mantra('mantra'),
  book('book');

  const SearchScope(this.wire);

  final String wire;
}

/// One search: the words typed, and the book the reader narrowed it to (a slug),
/// if they did. A value, so a provider keyed by it is one result set per search.
class SearchRequest {
  const SearchRequest(this.query, {this.book});

  final String query;
  final String? book;

  @override
  bool operator ==(Object other) =>
      other is SearchRequest && other.query == query && other.book == book;

  @override
  int get hashCode => Object.hash(query, book);
}

/// The book a search was narrowed to, and how: by the reader's chip, or by a book's
/// name typed at the start of the query ("gita karma").
class SearchBookScope {
  const SearchBookScope({
    required this.slug,
    required this.title,
    required this.fromQuery,
    this.text = '',
  });

  final String slug;
  final String title;

  /// The name was typed in the query, not chosen with a chip.
  final bool fromQuery;

  /// What is left of the query once the book's name is taken off it.
  final String text;

  static SearchBookScope? fromJson(Json? json) => json == null
      ? null
      : SearchBookScope(
          slug: asString(json['slug']),
          title: asString(json['title']),
          fromQuery: asBool(json['fromQuery']),
          text: asString(json['text']),
        );
}

/// The quick, unpaginated preview across all three kinds — what a query first
/// lands on, before the reader opens one kind's full list. It also says how many
/// of each there are, which book the query was read as naming, and what it
/// corrected the spelling to.
class SearchOverview {
  const SearchOverview({
    required this.query,
    this.scope,
    this.corrected,
    this.verses = const [],
    this.verseHasMore = false,
    this.verseTotal = 0,
    this.mantras = const [],
    this.mantraHasMore = false,
    this.mantraTotal = 0,
    this.books = const [],
    this.bookHasMore = false,
    this.bookTotal = 0,
  });

  final String query;
  final SearchBookScope? scope;

  /// The query as it was read once typos were fixed; null when nothing needed fixing.
  final String? corrected;
  final List<Verse> verses;
  final bool verseHasMore;
  final int verseTotal;
  final List<Mantra> mantras;
  final bool mantraHasMore;
  final int mantraTotal;
  final List<Book> books;
  final bool bookHasMore;
  final int bookTotal;

  bool get isEmpty => verses.isEmpty && mantras.isEmpty && books.isEmpty;

  factory SearchOverview.fromJson(Json json) => SearchOverview(
        query: asString(json['query']),
        scope: SearchBookScope.fromJson(asJson(json['scope'])),
        corrected: asStringOrNull(json['corrected']),
        verses: asList(json['verses'], Verse.fromJson),
        verseHasMore: asBool(json['verseHasMore']),
        verseTotal: asInt(json['verseTotal']),
        mantras: asList(json['mantras'], Mantra.fromJson),
        mantraHasMore: asBool(json['mantraHasMore']),
        mantraTotal: asInt(json['mantraTotal']),
        books: asList(json['books'], Book.fromJson),
        bookHasMore: asBool(json['bookHasMore']),
        bookTotal: asInt(json['bookTotal']),
      );
}
