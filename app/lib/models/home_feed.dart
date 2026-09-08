import 'book.dart';
import 'json.dart';
import 'mantra.dart';
import 'sadhana.dart';
import 'sloka.dart';

/// Where the reader left off. The dashboard turns this into one tap back into
/// the book.
class ContinueReading {
  const ContinueReading({
    required this.book,
    this.verseId,
    this.cantoNumber,
    this.chapterNumber,
    this.verseNumber,
  });

  final Book book;
  final String? verseId;
  final int? cantoNumber;
  final int? chapterNumber;
  final int? verseNumber;

  factory ContinueReading.fromJson(Json json) => ContinueReading(
        book: Book.fromJson(asJson(json['book']) ?? const {}),
        verseId: asStringOrNull(json['verseId']),
        cantoNumber: asIntOrNull(json['cantoNumber']),
        chapterNumber: asIntOrNull(json['chapterNumber']),
        verseNumber: asIntOrNull(json['verseNumber']),
      );
}

/// The whole first screen in one response.
///
/// `/api/app/home` is public: signed out, the personal halves are simply null
/// rather than an error, so the same widget tree renders both cases.
class HomeFeed {
  const HomeFeed({
    required this.date,
    this.slokaOfTheDay,
    this.books = const [],
    this.mantras = const [],
    this.sadhana,
    this.mySloka,
    this.continueReading,
    this.unreadNotifications = 0,
    this.isPremium = false,
  });

  /// The user's own local date, decided by the server from their timezone —
  /// not the device clock, so a traveller does not skip a day.
  final String date;

  final DailySloka? slokaOfTheDay;
  final List<Book> books;
  final List<Mantra> mantras;

  final SadhanaSummary? sadhana;
  final PersonalSloka? mySloka;
  final ContinueReading? continueReading;
  final int unreadNotifications;
  final bool isPremium;

  bool get isPersonalised => sadhana != null || mySloka != null || continueReading != null;

  factory HomeFeed.fromJson(Json json) => HomeFeed(
        date: asString(json['date']),
        slokaOfTheDay: asJson(json['slokaOfTheDay']) == null
            ? null
            : DailySloka.fromJson(asJson(json['slokaOfTheDay'])!),
        books: asList(json['books'], Book.fromJson),
        mantras: asList(json['mantras'], Mantra.fromJson),
        sadhana: asJson(json['sadhana']) == null
            ? null
            : SadhanaSummary.fromJson(asJson(json['sadhana'])!),
        mySloka: asJson(json['mySloka']) == null
            ? null
            : PersonalSloka.fromJson(asJson(json['mySloka'])!),
        continueReading: asJson(json['continueReading']) == null
            ? null
            : ContinueReading.fromJson(asJson(json['continueReading'])!),
        unreadNotifications: asInt(json['unreadNotifications']),
        isPremium: asBool(json['isPremium']),
      );
}
