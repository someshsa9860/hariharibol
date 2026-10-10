import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:drift/native.dart';
import 'package:hariharibol/db/app_database.dart';
import 'package:hariharibol/models/book_cache.dart';

AppDatabase memoryDb() => AppDatabase(NativeDatabase.memory());

/// A unit's file, as the server writes it.
Map<String, dynamic> unitJson({
  String bookId = 'book1',
  String bookSlug = 'srimad-bhagavatam',
  String unitType = 'canto',
  String unitId = 'canto1',
  int unitNumber = 1,
  int versesPerChapter = 2,
  List<int> chapters = const [1, 2],
  String purportPrefix = 'purport',
  int schemaVersion = 1,
}) {
  final chapterRows = [
    for (final n in chapters)
      {
        'id': unitType == 'canto' ? 'ch$unitNumber-$n' : unitId,
        'number': n,
        'cantoNumber': unitType == 'canto' ? unitNumber : null,
        'title': 'Chapter $n',
        'titleI18n': {'hi': 'अध्याय $n'},
        'totalVerses': versesPerChapter,
      },
  ];
  return {
    'schemaVersion': schemaVersion,
    'updatedAt': '2026-01-01T00:00:00.000Z',
    'book': {'id': bookId, 'slug': bookSlug, 'bookNumber': 2, 'title': 'Srimad Bhagavatam'},
    'unit': {
      'type': unitType,
      'id': unitId,
      'number': unitNumber,
      'title': '$unitType $unitNumber',
      'totalVerses': versesPerChapter * chapters.length,
    },
    'chapters': chapterRows,
    'verses': [
      for (final ch in chapterRows)
        for (var v = 1; v <= versesPerChapter; v++)
          {
            'id': 'verse-${ch['id']}-$v',
            'verseId': '2.$unitNumber.${ch['number']}.$v',
            'chapterId': ch['id'],
            'chapterNumber': ch['number'],
            'cantoNumber': ch['cantoNumber'],
            'verseNumber': v,
            'type': 'SHLOKA',
            'sanskrit': 'श्लोक ${ch['number']}.$v',
            'transliteration': 'shloka ${ch['number']}.$v',
            'wordMeanings': [
              {'word': 'om', 'meaning': 'O my Lord'},
            ],
            'audioPath': v == 1 ? 'hariharibol/verses/audio/x.mp3' : null,
            'tags': <String>[],
            'translations': [
              {
                'id': 't-en-${ch['id']}-$v',
                'languageCode': 'en',
                'type': 'TRANSLATION',
                'translatorId': 'tr1',
                'translatorSlug': 'prabhupada',
                'translatorName': 'Prabhupada',
                'meaning': 'english meaning ${ch['number']}.$v',
                'purport': '$purportPrefix english ${ch['number']}.$v',
                'displayOrder': 0,
              },
              {
                'id': 't-hi-${ch['id']}-$v',
                'languageCode': 'hi',
                'type': 'TRANSLATION',
                'translatorId': 'tr2',
                'translatorSlug': 'gita-press',
                'translatorName': 'Gita Press',
                'meaning': 'हिंदी अर्थ ${ch['number']}.$v',
                'purport': null,
                'displayOrder': 0,
              },
            ],
          },
    ],
  };
}

/// The canonical bytes and their hash — what the server stores and promises.
({Uint8List bytes, String hash}) unitBytes(Map<String, dynamic> json, {bool gzipped = false}) {
  final raw = Uint8List.fromList(utf8.encode(jsonEncode(json)));
  final hash = sha256.convert(raw).toString();
  return (bytes: gzipped ? Uint8List.fromList(gzip.encode(raw)) : raw, hash: hash);
}

UnitPayload payloadOf(Map<String, dynamic> json) => UnitPayload.fromJson(json);
