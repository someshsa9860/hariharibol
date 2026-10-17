// The one rule for the app's words: whatever is added to `lib/l10n/app_en.arb`
// is translated into every other `lib/l10n/app_*.arb` in the same change.
//
// `flutter gen-l10n` only prints a warning for a missing translation, and the
// app then shows English without a sound, so this test is what makes the rule
// bite. It reads the ARB files themselves, so a language file is checked the
// moment it exists. The rule and the house style: "Standard localization" in
// app/CLAUDE.md and lib/l10n/README.md.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/l10n/generated/app_localizations.dart';

const _l10nDir = 'lib/l10n';

/// Keys whose text is a name or a code that is written the same in every
/// language. Nearly empty on purpose: "HariHariBol" and texts made only of
/// placeholders and punctuation never need an entry. Add a key only when the
/// "still English" check below is wrong about it.
const _sameInEveryLanguage = <String>{
  // Sakha's name alone, under the raised button of the bar. The app keeps it in
  // Latin letters in every language (see "AI chat" in app/CLAUDE.md).
  'tabSakha',
};

typedef _Arb = Map<String, dynamic>;

_Arb _read(String path) => jsonDecode(File(path).readAsStringSync()) as _Arb;

/// The messages in an ARB file: everything except `@@locale` and `@key` metadata.
List<String> _messageKeys(_Arb arb) => [
  for (final key in arb.keys)
    if (!key.startsWith('@')) key,
];

/// A short list for a failure message.
String _list(Iterable<String> keys, {int max = 12}) {
  final all = keys.toList();
  final shown = all.take(max).join(', ');
  return all.length > max ? '$shown … (${all.length} in all)' : shown;
}

/// True when [text] uses the placeholder [name], bare (`{name}`) or as the head
/// of a plural / select (`{name, plural, …}`).
bool _usesPlaceholder(String text, String name) =>
    RegExp('\\{\\s*$name\\s*[,}]').hasMatch(text);

/// A non-ASCII decimal digit, such as ४ or ৪. gen-l10n writes numbers such as
/// `{count}` with Latin digits, so a translation that mixes in another set would
/// show two kinds of digit side by side.
final _nativeDigit = RegExp(r'(?![0-9])\p{Nd}', unicode: true);

/// True when [text] still holds an English word once placeholders and the brand
/// are taken out. Three Latin letters in a row is a word; "BG", "SB" and "MB" are not.
bool _hasEnglishWord(String text) {
  final rest = text.replaceAll(RegExp(r'\{\s*\w+\s*\}'), '').replaceAll('HariHariBol', '');
  return RegExp('[A-Za-z]{3,}').hasMatch(rest);
}

void main() {
  final template = _read('$_l10nDir/app_en.arb');
  final templateKeys = _messageKeys(template);

  // Every app_xx.arb except the template, by language code.
  final translations = <String, _Arb>{};
  for (final entity in Directory(_l10nDir).listSync()) {
    final code = RegExp(r'app_(\w+)\.arb$').firstMatch(entity.path)?.group(1);
    if (code == null || code == 'en') continue;
    translations[code] = _read(entity.path);
  }
  final codes = translations.keys.toList()..sort();

  /// The placeholders [key]'s English text really uses (the template declares
  /// them in its `@key` metadata).
  Set<String> placeholdersOf(String key) {
    final metadata = template['@$key'] as Map<String, dynamic>?;
    final declared = (metadata?['placeholders'] as Map<String, dynamic>?)?.keys ?? const [];
    final english = template[key] as String;
    return {
      for (final name in declared)
        if (_usesPlaceholder(english, name)) name,
    };
  }

  test('there are translations to check', () {
    expect(templateKeys, isNotEmpty);
    expect(codes, isNotEmpty, reason: 'no app_*.arb next to app_en.arb in $_l10nDir');
  });

  for (final code in codes) {
    final arb = translations[code]!;

    group('app_$code.arb', () {
      // The keys it has, so the checks below skip a key `translates every key`
      // already reports instead of reporting it twice.
      final present = templateKeys.where(arb.containsKey).toList();

      test('names its own locale', () {
        expect(arb['@@locale'], code);
      });

      test('translates every key of app_en.arb, and nothing else', () {
        final missing = templateKeys.where((key) => !arb.containsKey(key));
        final extra = _messageKeys(arb).where((key) => !template.containsKey(key));
        expect(
          missing,
          isEmpty,
          reason:
              'Missing from app_$code.arb. Translate them in the same change as '
              'app_en.arb: ${_list(missing)}',
        );
        expect(
          extra,
          isEmpty,
          reason:
              'In app_$code.arb but not in app_en.arb (renamed or removed there?): '
              '${_list(extra)}',
        );
      });

      test('keeps its metadata in app_en.arb only', () {
        final stray = arb.keys.where((key) => key.startsWith('@') && key != '@@locale');
        expect(
          stray,
          isEmpty,
          reason: 'Descriptions and placeholder types live in app_en.arb alone: ${_list(stray)}',
        );
      });

      test('writes every message as text', () {
        final notText = present.where((key) => arb[key] is! String);
        expect(notText, isEmpty, reason: 'Not a string in app_$code.arb: ${_list(notText)}');
      });

      test('has no empty message', () {
        final empty = present.where(
          (key) => arb[key] is String && (arb[key] as String).trim().isEmpty,
        );
        expect(empty, isEmpty, reason: 'Empty in app_$code.arb: ${_list(empty)}');
      });

      test('keeps every placeholder of the English text', () {
        final lost = <String>[];
        for (final key in present) {
          final value = arb[key];
          if (value is! String) continue;
          for (final name in placeholdersOf(key)) {
            if (!_usesPlaceholder(value, name)) lost.add('$key needs {$name}');
          }
        }
        expect(lost, isEmpty, reason: 'Dropped from app_$code.arb: ${_list(lost)}');
      });

      test('is not left in English', () {
        final english = present.where((key) {
          final value = arb[key];
          return value is String &&
              value == template[key] &&
              !_sameInEveryLanguage.contains(key) &&
              _hasEnglishWord(value);
        });
        expect(
          english,
          isEmpty,
          reason:
              'Still identical to English in app_$code.arb: ${_list(english)}. Translate them, or '
              'if the text really is the same everywhere add the key to _sameInEveryLanguage.',
        );
      });

      test('uses Latin digits only', () {
        final native = present.where((key) {
          final value = arb[key];
          return value is String && _nativeDigit.hasMatch(value);
        });
        expect(native, isEmpty, reason: 'Non-Latin digits in app_$code.arb: ${_list(native)}');
      });
    });
  }

  group('the languages the app ships', () {
    // English is the template; every other language is a file next to it.
    final shipped = {'en', ...codes};

    test('are the ones the generated code knows', () {
      expect(
        AppLocalizations.supportedLocales.map((locale) => locale.languageCode).toSet(),
        shipped,
        reason: 'Run `tool/flutter.sh gen-l10n` and commit lib/l10n/generated/.',
      );
    });

    test('are all listed in the iOS Info.plist', () {
      final plist = File('ios/Runner/Info.plist').readAsStringSync();
      final block = RegExp(
        r'<key>CFBundleLocalizations</key>\s*<array>(.*?)</array>',
        dotAll: true,
      ).firstMatch(plist)?.group(1);
      expect(block, isNotNull, reason: 'CFBundleLocalizations is missing from Info.plist');
      final listed = RegExp(
        r'<string>([^<]+)</string>',
      ).allMatches(block!).map((match) => match.group(1)!).toSet();
      expect(
        listed,
        shipped,
        reason:
            'CFBundleLocalizations in ios/Runner/Info.plist must list exactly the languages '
            'that have an ARB file; iOS does not offer one that is missing.',
      );
    });
  });

  group('every shipped locale', () {
    for (final locale in AppLocalizations.supportedLocales) {
      final code = locale.languageCode;

      test('$code: Flutter has its own strings for it', () {
        expect(GlobalMaterialLocalizations.delegate.isSupported(locale), isTrue);
        expect(GlobalWidgetsLocalizations.delegate.isSupported(locale), isTrue);
        expect(GlobalCupertinoLocalizations.delegate.isSupported(locale), isTrue);
      });

      // Through the delegates, as the app does: a bare DateFormat has no locale
      // data in a test (see localization_test.dart), and this is the line that
      // would throw on a language whose date data is missing.
      testWidgets('$code: writes the date line', (tester) async {
        String? line;
        await tester.pumpWidget(
          MaterialApp(
            locale: locale,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: Builder(
              builder: (context) {
                line = AppLocalizations.of(context).homeDateLine(DateTime(2026, 4, 27));
                return const SizedBox.shrink();
              },
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(line, isNotNull, reason: 'the $code locale never finished loading');
        expect(line, isNotEmpty);
      });
    }
  });
}
