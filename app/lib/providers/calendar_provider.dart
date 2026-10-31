import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/calendar.dart';
import '../services/calendar_service.dart';
import 'language_settings_provider.dart';
import 'saved_then_fresh.dart';

/// The language festival names are asked for in: the app language, as the
/// server's festival push uses it.
final _calendarLanguageProvider = Provider<String>((ref) {
  return ref.watch(languageSettingsProvider.select((s) => s.app));
});

/// One month of the calendar, the saved copy first and then the network's. The
/// family key is the first of the month, so two widgets asking for the same
/// month share one request.
final calendarMonthProvider = StreamProvider.autoDispose.family<CalendarRange, DateTime>((ref, month) {
  final language = ref.watch(_calendarLanguageProvider);
  final service = CalendarService.instance;
  return savedThenFresh(
    () => service.savedMonth(month, language: language),
    () => service.month(month, language: language),
  );
});

/// The Ekadashi, Chaturthi and festival days of the next month, for Home.
final upcomingFestivalsProvider = StreamProvider.autoDispose<List<CalendarFestival>>((ref) {
  final language = ref.watch(_calendarLanguageProvider);
  final service = CalendarService.instance;
  return savedThenFresh(
    () => service.savedUpcoming(language: language),
    () => service.upcoming(language: language),
  );
});
