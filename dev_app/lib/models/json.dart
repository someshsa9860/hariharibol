/// Small readers used by every `fromJson`.
///
/// The API is ours, but a field can still arrive null after a deploy, and a
/// crash in a parser takes down a whole screen. These coerce instead: a missing
/// string is empty, a missing number is zero, a bad date is null.
typedef Json = Map<String, dynamic>;

String asString(dynamic value, [String fallback = '']) {
  if (value == null) return fallback;
  return value is String ? value : value.toString();
}

String? asStringOrNull(dynamic value) {
  if (value == null) return null;
  final text = value is String ? value : value.toString();
  return text.isEmpty ? null : text;
}

int asInt(dynamic value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

int? asIntOrNull(dynamic value) {
  if (value == null) return null;
  return asInt(value, 0);
}

double asDouble(dynamic value, [double fallback = 0]) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

bool asBool(dynamic value, [bool fallback = false]) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) return value == 'true' || value == '1';
  return fallback;
}

/// The API sends ISO-8601 in UTC. Parsed to local so callers never have to
/// remember to convert before formatting.
DateTime? asDate(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value.toLocal();
  final parsed = DateTime.tryParse(value.toString());
  return parsed?.toLocal();
}

Json? asJson(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : null;

List<String> asStringList(dynamic value) {
  if (value is! List) return const [];
  return value.map((item) => asString(item)).where((item) => item.isNotEmpty).toList();
}

/// Maps a JSON array through a parser, skipping anything that is not an object.
List<T> asList<T>(dynamic value, T Function(Json) parse) {
  if (value is! List) return const [];
  return value.whereType<Map>().map((item) => parse(Map<String, dynamic>.from(item))).toList();
}
