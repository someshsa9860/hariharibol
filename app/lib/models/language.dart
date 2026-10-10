import 'json.dart';

/// A language the app offers, and which of the three slots it may fill.
///
/// The slots are not interchangeable: Sanskrit is a mantra language but not an
/// app language, so a picker has to filter on the flag for the slot it is
/// setting rather than offering everything and being refused by the API.
class Language {
  const Language({
    required this.code,
    required this.nativeName,
    required this.englishName,
    this.isRtl = false,
    this.isAppLanguage = true,
    this.isMantraLanguage = true,
    this.isReadingLanguage = true,
  });

  final String code;

  /// "हिन्दी" — what someone who reads it calls it, and what leads in the UI.
  final String nativeName;

  /// "Hindi" — the label under it, for anyone who does not.
  final String englishName;

  final bool isRtl;
  final bool isAppLanguage;
  final bool isMantraLanguage;
  final bool isReadingLanguage;

  /// True when this language may fill [slot].
  bool allows(LanguageSlot slot) => switch (slot) {
        LanguageSlot.app => isAppLanguage,
        LanguageSlot.mantra => isMantraLanguage,
        LanguageSlot.reading => isReadingLanguage,
        // What can be spoken is what there is text to read aloud in.
        LanguageSlot.speaking => isReadingLanguage,
      };

  factory Language.fromJson(Json json) => Language(
        code: asString(json['code']),
        nativeName: asString(json['nativeName']),
        englishName: asString(json['englishName']),
        isRtl: asBool(json['isRtl']),
        isAppLanguage: asBool(json['isAppLanguage'], true),
        isMantraLanguage: asBool(json['isMantraLanguage'], true),
        isReadingLanguage: asBool(json['isReadingLanguage'], true),
      );
}

/// The three independent settings an account holds.
enum LanguageSlot { app, mantra, reading, speaking }
