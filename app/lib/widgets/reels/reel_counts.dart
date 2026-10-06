import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

/// 1200 → "1.2K", and in a Hindi or Marathi locale the lakh/crore form those
/// readers actually use.
///
/// Through `intl` rather than a hand-rolled suffix table: the abbreviations
/// are locale data, not app copy, so writing "K"/"L"/"Cr" into the source
/// would be both a hardcoded string and the wrong one for most of this app's
/// readers. The action rail is 52 points wide, so a raw five-digit count does
/// not fit — and nobody reads the last three digits of a like count anyway.
String compactCount(BuildContext context, int value) {
  final locale = Localizations.localeOf(context).toString();
  return NumberFormat.compact(locale: locale).format(value);
}

/// The same number spelled out in full, for a screen reader. "1.2K followers"
/// is worse to listen to than "one thousand two hundred".
String fullCount(BuildContext context, int value) {
  final locale = Localizations.localeOf(context).toString();
  return NumberFormat.decimalPattern(locale).format(value);
}
