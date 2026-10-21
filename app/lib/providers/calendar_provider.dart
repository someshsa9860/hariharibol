import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/calendar.dart';
import '../services/calendar_service.dart';

/// One month of the calendar. The family key is the first of the month, so two
/// widgets asking for the same month share one request.
final calendarMonthProvider = FutureProvider.autoDispose.family<CalendarRange, DateTime>((ref, month) {
  return CalendarService.instance.month(month);
});

/// The Ekadashi, Chaturthi and festival days of the next month, for Home.
final upcomingFestivalsProvider = FutureProvider.autoDispose<List<CalendarFestival>>((ref) {
  return CalendarService.instance.upcoming();
});
