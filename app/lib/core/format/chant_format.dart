import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

/// How the counter writes times. The clock and the seconds are bare numbers, so
/// none of that needs a translation — the words around them come from l10n. The
/// two wall-clock helpers at the bottom take the context because month names
/// and 12/24-hour habits belong to the reader's locale.

/// `m:ss`, or `h:mm:ss` once a sitting passes the hour.
String formatClock(Duration duration) {
  final total = duration.inSeconds < 0 ? 0 : duration.inSeconds;
  final hours = total ~/ 3600;
  final minutes = (total % 3600) ~/ 60;
  final seconds = total % 60;
  final ss = seconds.toString().padLeft(2, '0');
  if (hours > 0) return '$hours:${minutes.toString().padLeft(2, '0')}:$ss';
  return '$minutes:$ss';
}

/// Seconds to one decimal — `1.8`. The caller adds the unit.
String formatSeconds(double seconds) => seconds.toStringAsFixed(1);

/// The same, from milliseconds.
String formatMillisAsSeconds(int milliseconds) => formatSeconds(milliseconds / 1000);

/// Wall-clock time of a tap, to the second — `10:42:31`.
String formatTimeOfDay(BuildContext context, DateTime time) =>
    DateFormat.Hms(Localizations.localeOf(context).toString()).format(time);

/// A sitting's start in the history list — `Oct 6, 2026 6:12 AM`.
String formatDateTime(BuildContext context, DateTime time) =>
    DateFormat.yMMMd(Localizations.localeOf(context).toString()).add_jm().format(time);
