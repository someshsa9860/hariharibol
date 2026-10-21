import '../core/constants/api_paths.dart';
import '../models/calendar.dart';
import '../models/json.dart';
import 'api_client.dart';

/// The Hindu calendar. It is worked out and kept by the server
/// (`backend/services/panchang.js`); this only reads it.
class CalendarService {
  CalendarService._();

  static final CalendarService instance = CalendarService._();

  final ApiClient _api = ApiClient.instance;

  /// Every day of [month] (year and month; the day is ignored) and its festivals.
  Future<CalendarRange> month(DateTime month) async {
    final first = DateTime.utc(month.year, month.month, 1);
    final last = DateTime.utc(month.year, month.month + 1, 0);
    String ymd(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    final response = await _api.get(ApiPaths.calendar, query: {'from': ymd(first), 'to': ymd(last)});
    return CalendarRange.fromJson(response.json);
  }

  /// The Ekadashi, Chaturthi and festival days coming up, soonest first.
  Future<List<CalendarFestival>> upcoming({int days = 30}) async {
    final response = await _api.get(ApiPaths.calendarUpcoming, query: {'days': days});
    return (response.json['festivals'] as List? ?? const [])
        .map((f) => CalendarFestival.fromJson(asJson(f) ?? const {}))
        .toList();
  }
}
