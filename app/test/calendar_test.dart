import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/models/calendar.dart';
import 'package:hariharibol/services/push_link.dart';
import 'package:hariharibol/core/navigation/app_routes.dart';

void main() {
  test('a range reads days and festivals from the API shape', () {
    final range = CalendarRange.fromJson({
      'today': '2026-01-14',
      'location': {'name': 'New Delhi'},
      'days': [
        {
          'date': '2026-01-14',
          'tithi': {'number': 26, 'name': 'Ekadashi', 'paksha': 'KRISHNA'},
          'nakshatra': {'name': 'Anuradha'},
          'yoga': 'Ganda',
          'karana': 'Balava',
          'month': 'Pausha',
          'isAdhika': false,
          'vikramSamvat': 2082,
        },
      ],
      'festivals': [
        {'date': '2026-01-14', 'slug': 'ekadashi', 'kind': 'EKADASHI', 'name': 'Shattila Ekadashi'},
        {'date': '2026-01-14', 'slug': 'pradosh', 'kind': 'PRADOSH', 'name': 'Krishna Pradosh Vrat'},
      ],
    });
    final day = range.dayOn('2026-01-14')!;
    expect(day.tithi, 'Ekadashi');
    expect(day.paksha, 'K');
    expect(range.placeName, 'New Delhi');
    expect(range.festivalsOn('2026-01-14').first.kind, FestivalKind.ekadashi);
    expect(range.festivalsOn('2026-01-14').where((f) => !f.kind.isQuiet), hasLength(1));
    expect(range.dayOn('2026-01-15'), isNull);
  });

  test('an unknown kind is drawn as a festival', () {
    expect(FestivalKind.fromApi('SOMETHING_NEW'), FestivalKind.festival);
  });

  test('a parana is its own kind, drawn on the tile like an Ekadashi', () {
    expect(FestivalKind.fromApi('PARANA'), FestivalKind.parana);
    expect(FestivalKind.parana.glyph, 'parana');
    expect(FestivalKind.parana.isQuiet, isFalse);
  });

  test('the festival push opens the calendar', () {
    expect(pushRoute({'deeplink': 'hariharibol://calendar'}), AppRoutes.calendar);
  });
}
