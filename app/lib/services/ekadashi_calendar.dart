import 'dart:math' as math;

import '../core/constants/routine_config.dart';

/// Which days are Ekadashi — the eleventh tithi of each fortnight, twice a
/// month, fasted by Vaishnavas.
///
/// Worked out on the phone from the positions of the sun and moon, so it needs
/// no server and no network. A tithi is each 12° the moon gains on the sun; the
/// 11th runs from 120° to 132° of that gap and the 26th (the 11th of the dark
/// fortnight) from 300° to 312°.
///
/// **Approximate.** The positions are the low-precision series from Meeus's
/// *Astronomical Algorithms* (the moon to about 0.3°, roughly 40 minutes of
/// time), and a day is called Ekadashi when that tithi is running at
/// [RoutineConfig.sunriseHour] local time (or, if it falls between two
/// sunrises, the day it falls on). Printed Vaishnava almanacs apply
/// further rules — a tithi that starts only just before sunrise, the Dvadashi
/// fast — so a date can differ from the one a temple publishes by a day. Use
/// it to mark the calendar, not to settle which morning to keep the fast.
class EkadashiCalendar {
  const EkadashiCalendar({
    this.sunriseHour = RoutineConfig.sunriseHour,
    this.momentOf = _local,
  });

  final int sunriseHour;

  /// The instant a day's sunrise hour is. Local time unless a test says where
  /// on earth it is.
  final DateTime Function(int year, int month, int day, int hour) momentOf;

  static DateTime _local(int year, int month, int day, int hour) =>
      DateTime(year, month, day, hour);

  /// Whether the calendar day of [day] (its year, month and day — the time is
  /// ignored) is Ekadashi.
  bool isEkadashi(DateTime day) {
    final today = tithiAt(momentOf(day.year, day.month, day.day, sunriseHour));
    if (today == 11 || today == 26) return true;

    // A tithi that begins after one sunrise and is over before the next is
    // never "at sunrise" on any day; the almanacs give it to the day it falls
    // on. It shows as the 10th at this sunrise and the 12th at the next.
    final next = tithiAt(momentOf(day.year, day.month, day.day + 1, sunriseHour));
    return (today == 10 && next == 12) || (today == 25 && next == 27);
  }

  /// The tithi, 1–30, running at [moment]: 1–15 in the bright fortnight, 16–30
  /// in the dark.
  static int tithiAt(DateTime moment) {
    final t = _centuries(moment);
    final gap = _normalise(_moonLongitude(t) - _sunLongitude(t));
    return gap ~/ _tithiDegrees + 1;
  }

  static const double _tithiDegrees = 12;

  /// Julian centuries since J2000.0, for a moment given in any zone.
  static double _centuries(DateTime moment) {
    const unixEpochJulianDay = 2440587.5;
    const j2000 = 2451545.0;
    final days =
        moment.toUtc().millisecondsSinceEpoch / Duration.millisecondsPerDay;
    return (unixEpochJulianDay + days - j2000) / 36525;
  }

  static double _sunLongitude(double t) {
    final meanLongitude = 280.46646 + 36000.76983 * t;
    final anomaly = _rad(357.52911 + 35999.05029 * t);
    final centre =
        (1.914602 - 0.004817 * t) * math.sin(anomaly) +
        0.019993 * math.sin(2 * anomaly) +
        0.000289 * math.sin(3 * anomaly);
    return _normalise(meanLongitude + centre);
  }

  static double _moonLongitude(double t) {
    final meanLongitude = 218.3164477 + 481267.88123421 * t;
    final elongation = _rad(297.8501921 + 445267.1114034 * t);
    final sunAnomaly = _rad(357.5291092 + 35999.0502909 * t);
    final moonAnomaly = _rad(134.9633964 + 477198.8675055 * t);
    final latitudeArgument = _rad(93.2720950 + 483202.0175233 * t);

    final correction =
        6.288774 * math.sin(moonAnomaly) +
        1.274027 * math.sin(2 * elongation - moonAnomaly) +
        0.658314 * math.sin(2 * elongation) +
        0.213618 * math.sin(2 * moonAnomaly) -
        0.185116 * math.sin(sunAnomaly) -
        0.114332 * math.sin(2 * latitudeArgument) +
        0.058793 * math.sin(2 * elongation - 2 * moonAnomaly) +
        0.057066 * math.sin(2 * elongation - sunAnomaly - moonAnomaly) +
        0.053322 * math.sin(2 * elongation + moonAnomaly) +
        0.045758 * math.sin(2 * elongation - sunAnomaly);
    return _normalise(meanLongitude + correction);
  }

  static double _rad(double degrees) => degrees * math.pi / 180;

  static double _normalise(double degrees) => ((degrees % 360) + 360) % 360;
}
