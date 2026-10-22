import 'package:intl/intl.dart';

import '../../l10n/generated/app_localizations.dart';

/// How long ago something happened, in the reader's locale: "Just now", a clock time today, "Yesterday", or a date.
String whenText(AppLocalizations text, String locale, DateTime at, {DateTime? now}) {
  final current = now ?? DateTime.now();
  final local = at.toLocal();
  final difference = current.difference(local);
  if (difference.inSeconds < 45 && !difference.isNegative) return text.timeJustNow;

  final today = DateTime(current.year, current.month, current.day);
  final day = DateTime(local.year, local.month, local.day);
  final days = today.difference(day).inDays;
  if (days <= 0) return DateFormat.Hm(locale).format(local);
  if (days == 1) return text.timeYesterday;
  if (local.year == current.year) return DateFormat.MMMd(locale).format(local);
  return DateFormat.yMMMd(locale).format(local);
}

/// A date and time, for the details sheet.
String dateTimeText(String locale, DateTime at) => DateFormat.yMMMd(locale).add_Hm().format(at.toLocal());
