import 'package:flutter/foundation.dart';

/// The three languages a reader sets, each on its own.
///
///   app       menus, buttons and labels (an ARB file must exist for it)
///   reading   the language of translation, meaning and purport
///   speaking  the language audio and spoken text use
///
/// None is derived from another: changing one never changes the others. The
/// Sanskrit of a verse is not in this list — it is always Sanskrit.
@immutable
class LanguageSettings {
  const LanguageSettings({required this.app, required this.reading, required this.speaking});

  final String app;
  final String reading;
  final String speaking;

  LanguageSettings copyWith({String? app, String? reading, String? speaking}) => LanguageSettings(
        app: app ?? this.app,
        reading: reading ?? this.reading,
        speaking: speaking ?? this.speaking,
      );

  @override
  bool operator ==(Object other) =>
      other is LanguageSettings && other.app == app && other.reading == reading && other.speaking == speaking;

  @override
  int get hashCode => Object.hash(app, reading, speaking);

  @override
  String toString() => 'LanguageSettings(app: $app, reading: $reading, speaking: $speaking)';
}

/// How a first value is chosen when the reader has not chosen one.
abstract final class LanguageDefaults {
  static const String fallback = 'en';

  /// stored → the account's own choice (if there is one) → the device language
  /// → English. [supported] limits what is acceptable (the app language must
  /// have an ARB file); null accepts anything.
  static String resolve({
    String? stored,
    String? account,
    required String device,
    Set<String>? supported,
  }) {
    bool ok(String? code) => code != null && code.isNotEmpty && (supported == null || supported.contains(code));
    if (ok(stored)) return stored!;
    if (ok(account)) return account!;
    if (ok(device)) return device;
    return fallback;
  }

  /// "hi_IN", "hi-IN", "hi" → "hi".
  static String languageOf(String localeName) {
    final match = RegExp(r'^[A-Za-z]{2,3}').firstMatch(localeName);
    return match == null ? fallback : match.group(0)!.toLowerCase();
  }
}
