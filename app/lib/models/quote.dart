import 'json.dart';

/// One quotation shown on the chanting page (`GET /api/app/quotes`).
///
/// [text] is already in the reader's reading language, or English where there
/// is no translation yet. [author] is always sent; whether it is drawn is
/// `AppConfig.showQuoteAuthor`, never the data's choice.
class Quote {
  const Quote({
    required this.id,
    required this.text,
    this.language = 'en',
    this.author,
    this.reference,
    this.sourceName,
    this.sourceUrl,
  });

  factory Quote.fromJson(Json json) => Quote(
        id: asString(json['id']),
        text: asString(json['text']),
        language: asString(json['language'], 'en'),
        author: asStringOrNull(json['author']),
        reference: asStringOrNull(json['reference']),
        sourceName: asStringOrNull(json['sourceName']),
        sourceUrl: asStringOrNull(json['sourceUrl']),
      );

  final String id;
  final String text;
  final String language;

  /// Whose words they are in the edition quoted; hidden while
  /// `AppConfig.showQuoteAuthor` is false.
  final String? author;

  /// Where it is from ("Bhagavad-gītā As It Is 6.6, purport").
  final String? reference;

  /// The site it was checked against, and its address.
  final String? sourceName;
  final String? sourceUrl;

  /// The quotes in an API answer, in the order sent, skipping any with no text.
  static List<Quote> listFromJson(Json json) {
    final items = json['items'];
    if (items is! List) return const [];
    return [
      for (final item in items)
        if (item is Map) Quote.fromJson(Map<String, dynamic>.from(item)),
    ].where((quote) => quote.text.trim().isNotEmpty).toList();
  }
}
