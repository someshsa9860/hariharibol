import 'json.dart';

/// One kind of day on the Hindu calendar. The name is what the API sends
/// (`FestivalKind` in `backend/prisma/schema.prisma`); [glyph] is the drawing in
/// `assets/calendar/`.
enum FestivalKind {
  ekadashi('EKADASHI', 'ekadashi'),
  chaturthi('CHATURTHI', 'chaturthi'),
  purnima('PURNIMA', 'purnima'),
  amavasya('AMAVASYA', 'amavasya'),
  pradosh('PRADOSH', 'pradosh'),
  sankranti('SANKRANTI', 'sankranti'),
  festival('FESTIVAL', 'festival');

  const FestivalKind(this.apiName, this.glyph);

  final String apiName;
  final String glyph;

  static FestivalKind fromApi(String? name) =>
      FestivalKind.values.firstWhere((k) => k.apiName == name, orElse: () => FestivalKind.festival);

  /// A plain pradosh or sankranti is in the day's details, not on its tile —
  /// the same rule the website follows.
  bool get isQuiet => this == FestivalKind.pradosh || this == FestivalKind.sankranti;
}

/// An Ekadashi, a Chaturthi or a festival on a date.
class CalendarFestival {
  const CalendarFestival({
    required this.date,
    required this.slug,
    required this.kind,
    required this.name,
    this.description,
    this.vaishnavaDate,
  });

  factory CalendarFestival.fromJson(Json json) => CalendarFestival(
        date: asString(json['date']),
        slug: asString(json['slug']),
        kind: FestivalKind.fromApi(asStringOrNull(json['kind'])),
        name: asString(json['name']),
        description: asStringOrNull(json['description']),
        vaishnavaDate: asStringOrNull(json['vaishnavaDate']),
      );

  /// `YYYY-MM-DD`, the calendar's own date.
  final String date;
  final String slug;
  final FestivalKind kind;
  final String name;
  final String? description;

  /// Set when Vaishnavas keep the day after [date].
  final String? vaishnavaDate;

  DateTime get day => DateTime.parse(date);
}

/// A day's panchang, for the place the calendar is worked out for.
class CalendarDay {
  const CalendarDay({
    required this.date,
    required this.tithiNumber,
    required this.tithi,
    required this.isShukla,
    required this.nakshatra,
    required this.yoga,
    required this.karana,
    required this.month,
    required this.isAdhika,
    required this.vikramSamvat,
    this.sunrise,
    this.sunset,
    this.notes,
  });

  factory CalendarDay.fromJson(Json json) {
    final tithi = asJson(json['tithi']) ?? const {};
    final nakshatra = asJson(json['nakshatra']) ?? const {};
    return CalendarDay(
      date: asString(json['date']),
      tithiNumber: asInt(tithi['number']),
      tithi: asString(tithi['name']),
      isShukla: asString(tithi['paksha']) == 'SHUKLA',
      nakshatra: asString(nakshatra['name']),
      yoga: asString(json['yoga']),
      karana: asString(json['karana']),
      month: asString(json['month']),
      isAdhika: asBool(json['isAdhika']),
      vikramSamvat: asInt(json['vikramSamvat']),
      sunrise: DateTime.tryParse(asString(json['sunrise']))?.toLocal(),
      sunset: DateTime.tryParse(asString(json['sunset']))?.toLocal(),
      notes: asStringOrNull(json['notes']),
    );
  }

  final String date;
  final int tithiNumber;
  final String tithi;
  final bool isShukla;
  final String nakshatra;
  final String yoga;
  final String karana;
  final String month;
  final bool isAdhika;
  final int vikramSamvat;
  final DateTime? sunrise;
  final DateTime? sunset;
  final String? notes;

  /// "S" or "K" — the fortnight, as the printed panchangs abbreviate it.
  String get paksha => isShukla ? 'S' : 'K';
}

/// A stretch of days and the festivals in it.
class CalendarRange {
  const CalendarRange({required this.today, required this.placeName, required this.days, required this.festivals});

  factory CalendarRange.fromJson(Json json) => CalendarRange(
        today: asString(json['today']),
        placeName: asString(asJson(json['location'])?['name']),
        days: (json['days'] as List? ?? const []).map((d) => CalendarDay.fromJson(asJson(d) ?? const {})).toList(),
        festivals:
            (json['festivals'] as List? ?? const []).map((f) => CalendarFestival.fromJson(asJson(f) ?? const {})).toList(),
      );

  /// Today at the calendar's place, `YYYY-MM-DD`.
  final String today;
  final String placeName;
  final List<CalendarDay> days;
  final List<CalendarFestival> festivals;

  CalendarDay? dayOn(String date) {
    for (final day in days) {
      if (day.date == date) return day;
    }
    return null;
  }

  List<CalendarFestival> festivalsOn(String date) => festivals.where((f) => f.date == date).toList();
}
