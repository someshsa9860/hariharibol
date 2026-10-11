// Which rendering a verse opens with. The rule that matters: Dnyaneshwari's ovis
// (a poetic expansion) are never the default for a Marathi reader while another
// rendering exists, and are still there to be picked from the compare sheet.
// The same cases as backend/test/pick-translation.test.js — the two must agree.

import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/db/app_database.dart';
import 'package:hariharibol/repositories/book_repository.dart';

TranslationRecord _row(String id, String language, String type) => TranslationRecord(
      id: id,
      verseRowId: 'v',
      languageCode: language,
      type: type,
      displayOrder: 0,
    );

final _ovi = _row('ovi', 'mr', 'POETIC_EXPANSION');
final _english = _row('en', 'en', 'TRANSLATION');
final _marathi = _row('mr', 'mr', 'TRANSLATION');
final _hindi = _row('hi', 'hi', 'TRANSLATION');

String? _pick(List<TranslationRecord> rows, List<String> chain) => BookRepository.pickTranslation(rows, chain)?.id;

void main() {
  test('a Marathi reader with no Marathi translation gets the next language, not the ovi', () {
    expect(_pick([_ovi, _english], ['mr', 'en']), 'en');
  });

  test('the order the rows come in does not matter', () {
    expect(_pick([_english, _ovi], ['mr', 'en']), 'en');
  });

  test('a Marathi translation beats the ovi in the same language', () {
    expect(_pick([_ovi, _marathi, _english], ['mr', 'en']), 'mr');
    expect(_pick([_marathi, _ovi, _english], ['mr', 'en']), 'mr');
  });

  test('the ovi still stands in when it is all there is', () {
    expect(_pick([_ovi], ['mr', 'en']), 'ovi');
  });

  test('the readers own language still comes first among translations', () {
    expect(_pick([_english, _hindi], ['hi', 'en']), 'hi');
    expect(_pick([_english, _hindi], ['en', 'hi']), 'en');
  });

  test('a reader who does not read Marathi is not affected', () {
    expect(_pick([_english], ['hi', 'en']), 'en');
  });

  test('a commentary in the readers language is picked as before', () {
    final commentary = _row('c', 'sa', 'COMMENTARY');
    expect(_pick([commentary], ['sa']), 'c');
  });

  test('nothing to choose from is null', () {
    expect(_pick([], ['mr', 'en']), isNull);
    expect(_pick([_english], ['hi']), isNull);
  });
}
