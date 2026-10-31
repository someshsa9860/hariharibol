import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/home_config.dart';
import '../models/calendar.dart';
import '../models/prayer.dart';
import 'calendar_provider.dart';
import 'prayer_provider.dart';

/// The festivals from today through the next [HomeConfig.festivalWeekDays] - 1
/// days, soonest first. Only the date counts: a Parana (fast-breaking) row is in
/// the week like any other festival, and it is the one a reader needs most.
List<CalendarFestival> festivalsThisWeek(List<CalendarFestival> upcoming, DateTime now) {
  final today = DateTime.utc(now.year, now.month, now.day);
  return [
    for (final festival in upcoming)
      if (_inWeek(festival, today)) festival,
  ];
}

bool _inWeek(CalendarFestival festival, DateTime today) {
  final day = festival.day;
  final gap = DateTime.utc(day.year, day.month, day.day).difference(today).inDays;
  return gap >= 0 && gap < HomeConfig.festivalWeekDays;
}

/// The prayer category offered at [now], or null when none is: the morning ones
/// before [HomeConfig.morningPrayerUntilHour], the evening ones from
/// [HomeConfig.eveningPrayerFromHour] on, and nothing between.
String? timeOfDayPrayerCategory(DateTime now) {
  if (now.hour < HomeConfig.morningPrayerUntilHour) return PrayerCategory.morning;
  if (now.hour >= HomeConfig.eveningPrayerFromHour) return PrayerCategory.evening;
  return null;
}

/// Up to [HomeConfig.timeOfDayPrayerCount] prayers of the category offered at [now].
List<Prayer> timeOfDayPrayers(List<Prayer> prayers, DateTime now) {
  final category = timeOfDayPrayerCategory(now);
  if (category == null) return const [];
  return prayers.where((prayer) => prayer.category == category).take(HomeConfig.timeOfDayPrayerCount).toList();
}

/// This week's festivals for Home. Empty while the calendar loads or cannot.
final thisWeekFestivalsProvider = Provider<List<CalendarFestival>>((ref) {
  final upcoming = ref.watch(upcomingFestivalsProvider).asData?.value ?? const <CalendarFestival>[];
  return festivalsThisWeek(upcoming, DateTime.now());
});

/// The prayers for this time of day, for Home. Empty while the list loads, or
/// when the time of day has none.
final timeOfDayPrayersProvider = Provider<List<Prayer>>((ref) {
  final list = ref.watch(prayerListProvider).asData?.value;
  if (list == null) return const [];
  return timeOfDayPrayers(list.items, DateTime.now());
});
