import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../models/calendar.dart';

/// The drawing for a kind of day: a lotus for Ekadashi, a modak for Chaturthi, a
/// lamp for a festival, and so on (`assets/calendar/`). Each kind has its own
/// colour so a month can be read at a glance; the light and dark themes get
/// different shades of it.
class CalendarGlyph extends StatelessWidget {
  const CalendarGlyph({super.key, required this.kind, this.size = 18});

  final FestivalKind kind;
  final double size;

  static Color colorFor(FestivalKind kind, Brightness brightness) {
    final dark = brightness == Brightness.dark;
    return switch (kind) {
      FestivalKind.ekadashi => dark ? const Color(0xFF6FCF8D) : const Color(0xFF2F7D4A),
      FestivalKind.chaturthi => dark ? const Color(0xFFFF9D57) : const Color(0xFFC4621B),
      FestivalKind.purnima => dark ? const Color(0xFFF2C75C) : const Color(0xFFB07A00),
      FestivalKind.amavasya => dark ? const Color(0xFFB8B0A6) : const Color(0xFF6A5F54),
      FestivalKind.pradosh => dark ? const Color(0xFF9A96FF) : const Color(0xFF5A55B8),
      FestivalKind.sankranti => dark ? const Color(0xFFE6B84A) : const Color(0xFFA37400),
      FestivalKind.festival => dark ? const Color(0xFFFF8A7D) : const Color(0xFFB3382C),
    };
  }

  @override
  Widget build(BuildContext context) {
    final color = colorFor(kind, Theme.of(context).brightness);
    return SvgPicture.asset(
      'assets/calendar/${kind.glyph}.svg',
      width: size,
      height: size,
      theme: SvgTheme(currentColor: color),
      excludeFromSemantics: true,
    );
  }
}
