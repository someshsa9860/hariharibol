import 'dart:convert';

/// The language whose text is the plain column on the server, and so the one a
/// pick stops at (`language.localised`).
const _english = 'en';

/// `{ language code: text }` from what a title or summary arrived as: a map
/// (the API), a JSON string (a Drift column) or nothing. Blank texts and
/// anything that is not text are left out, so a malformed value costs a title
/// its translation and never a screen.
Map<String, String> parseLocalised(Object? raw, {String? english}) {
  Object? decoded = raw;
  if (raw is String) {
    try {
      decoded = jsonDecode(raw);
    } catch (_) {
      decoded = null;
    }
  }

  final found = <String, String>{};
  if (decoded is Map) {
    for (final entry in decoded.entries) {
      final text = entry.value;
      if (entry.key is String && text is String && text.trim().isNotEmpty) found[entry.key as String] = text;
    }
  }
  // The plain column is the English one: kept in the map so English can always be picked.
  if (!found.containsKey(_english) && english != null && english.trim().isNotEmpty) found[_english] = english;
  return found;
}

/// The text for the first language of [chain] that [byLanguage] has, else
/// [fallback].
///
/// Walks the chain in order and **stops at English**, the same rule as the
/// server (`language.localised`): someone who reads English with the app in
/// Hindi has asked for English, and is not handed the Hindi title.
String pickLocalised(String fallback, Map<String, String> byLanguage, List<String> chain) {
  for (final code in chain) {
    final text = byLanguage[code];
    if (text != null && text.isNotEmpty) return text;
    if (code == _english) break;
  }
  return fallback;
}
