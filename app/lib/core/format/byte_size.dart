/// "62 MB", "1.4 GB" — for sizes of downloads. Decimal units, as the stores
/// and the phone's own storage screen show them.
String formatBytes(int bytes) {
  if (bytes < 1000) return '$bytes B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  var value = bytes / 1000;
  var unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  final shown = value >= 10 ? value.round().toString() : value.toStringAsFixed(1);
  return '$shown ${units[unit]}';
}
