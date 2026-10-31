import 'package:flutter/foundation.dart' show visibleForTesting;

import '../core/constants/api_paths.dart';
import '../core/constants/offline_config.dart';
import '../models/calendar.dart';
import '../models/json.dart';
import 'api_client.dart';
import 'response_cache.dart';

/// The Hindu calendar. It is worked out and kept by the server
/// (`backend/services/panchang.js`); this only reads it.
///
/// Every answer is kept for offline use, and each call names the [language] the
/// festival names should be in (the app language), so a saved month is never
/// shown in a language the reader has left. The server would otherwise use the
/// account's, which hears of a change a moment later.
class CalendarService {
  CalendarService._() : _api = ApiClient.instance;

  /// A service that talks through [api] instead of the app's own client, for
  /// tests that script the server.
  @visibleForTesting
  CalendarService.forTesting(ApiClient api) : _api = api;

  static final CalendarService instance = CalendarService._();

  final ApiClient _api;

  /// Every day of [month] (year and month; the day is ignored) and its festivals.
  Future<CalendarRange> month(DateTime month, {String? language}) async {
    final response = await _api.getOrSaved(ApiPaths.calendar, query: _monthQuery(month, language));
    return CalendarRange.fromJson(response.json);
  }

  CalendarRange? savedMonth(DateTime month, {String? language}) {
    final copy = _api.saved(ApiPaths.calendar, query: _monthQuery(month, language));
    return copy == null ? null : CalendarRange.fromJson(copy.json);
  }

  /// The Ekadashi, Chaturthi and festival days coming up, soonest first.
  Future<List<CalendarFestival>> upcoming({String? language}) async {
    final response = await _api.getOrSaved(ApiPaths.calendarUpcoming, query: _upcomingQuery(language));
    return _festivals(response);
  }

  /// The saved list, without the days that have since gone by.
  List<CalendarFestival>? savedUpcoming({String? language, DateTime? now}) {
    final copy = _api.saved(ApiPaths.calendarUpcoming, query: _upcomingQuery(language));
    if (copy == null) return null;
    final today = _ymd(now ?? DateTime.now());
    return _festivals(copy).where((festival) => festival.date.compareTo(today) >= 0).toList();
  }

  static List<CalendarFestival> _festivals(ApiResponse response) =>
      (response.json['festivals'] as List? ?? const [])
          .map((f) => CalendarFestival.fromJson(asJson(f) ?? const {}))
          .toList();

  static Map<String, dynamic> _monthQuery(DateTime month, String? language) => {
        'from': _ymd(DateTime.utc(month.year, month.month, 1)),
        'to': _ymd(DateTime.utc(month.year, month.month + 1, 0)),
        'language': ?language,
      };

  static Map<String, dynamic> _upcomingQuery(String? language) => {
        'days': OfflineConfig.upcomingFestivalDays,
        'language': ?language,
      };

  static String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
