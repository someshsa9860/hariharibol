import 'package:intl/intl.dart';

/// How the counter writes times. Numbers only, so none of it needs a
/// translation — the words around them come from l10n.

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

final DateFormat _timeFormat = DateFormat.Hms();
final DateFormat _dateTimeFormat = DateFormat.yMMMd().add_jm();

/// Wall-clock time of a tap, to the second — `10:42:31`.
String formatTimeOfDay(DateTime time) => _timeFormat.format(time);

/// A sitting's start in the history list — `Oct 6, 2026 6:12 AM`.
String formatDateTime(DateTime time) => _dateTimeFormat.format(time);
