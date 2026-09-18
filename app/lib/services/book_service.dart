import '../core/constants/api_paths.dart';
import '../models/book.dart';
import '../models/verse.dart';
import 'api_client.dart';

/// The library's books, and reading into one. Listing and reading are both
/// public — signed out, the library still browses, the same as mantras.
class BookService {
  BookService._();

  static final BookService instance = BookService._();

  final ApiClient _api = ApiClient.instance;

  Future<List<Book>> list() async {
    final response = await _api.get(ApiPaths.books);
    return response.list
        .whereType<Map>()
        .map((item) => Book.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<Book> get(String slug) async {
    final response = await _api.get(ApiPaths.book(slug));
    return Book.fromJson(response.json);
  }

  /// Empty for a book with no canto level — the caller does not have to
  /// branch on [Book.hasCantos] before calling this.
  Future<List<BookSection>> cantos(String slug) async {
    final response = await _api.get(ApiPaths.bookCantos(slug));
    return response.list
        .whereType<Map>()
        .map((item) => BookSection.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// [canto] narrows to one canto for a book organised by them; omitted for
  /// the Gita, which has none.
  Future<List<BookSection>> chapters(String slug, {int? canto}) async {
    final response = await _api.get(
      ApiPaths.bookChapters(slug),
      query: canto == null ? null : {'canto': canto},
    );
    return response.list
        .whereType<Map>()
        .map((item) => BookSection.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// The reading screen's one call: the chapter and every verse in it,
  /// already resolved to the reader's language.
  Future<ChapterReading> chapter(String slug, int number, {int? canto}) async {
    final response = await _api.get(
      ApiPaths.bookChapter(slug, number),
      query: canto == null ? null : {'canto': canto},
    );
    return ChapterReading.fromJson(response.json);
  }

  /// Every chapter in [canto] (or the whole book, for one with none) in a
  /// single call — the offline download path, not the reading screen. A book
  /// with cantos requires one, and is meant to be called once per canto: its
  /// translations and purports are too large to fetch as a whole book at once.
  Future<List<ChapterReading>> chaptersBulk(String slug, {int? canto}) async {
    final response = await _api.get(
      ApiPaths.bookChaptersBulk(slug),
      query: canto == null ? null : {'canto': canto},
    );
    return response.list
        .whereType<Map>()
        .map((item) => ChapterReading.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// A short work's reading screen, in one call — every verse of a book with
  /// no chapters (a stotra, aarti, prayer or poem), already resolved to the
  /// reader's language.
  Future<List<Verse>> verses(String slug) async {
    final response = await _api.get(ApiPaths.bookVerses(slug));
    return response.list
        .whereType<Map>()
        .map((item) => Verse.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }
}
