import 'dart:convert';
import 'dart:io' show gzip;
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

import 'json.dart';

// What the offline sync talks in: the server's manifest, the link to one unit,
// and the unit's file once parsed. The file's shape is written by
// `backend/services/book-cache.js`.

/// One downloadable unit as the manifest lists it: a chapter, or a canto.
class ManifestUnit {
  const ManifestUnit({
    required this.unitId,
    required this.unitType,
    required this.number,
    required this.version,
    required this.hash,
    this.sizeBytes = 0,
    this.verseCount = 0,
    this.schemaVersion = 1,
  });

  final String unitId;

  /// `chapter` or `canto`.
  final String unitType;

  /// The chapter or canto number — what the reader is looking at.
  final int number;
  final int version;
  final String hash;
  final int sizeBytes;
  final int verseCount;
  final int schemaVersion;

  factory ManifestUnit.fromJson(Json json) => ManifestUnit(
        unitId: asString(json['unitId']),
        unitType: asString(json['unitType']),
        number: asInt(json['number']),
        version: asInt(json['version']),
        hash: asString(json['hash']),
        sizeBytes: asInt(json['sizeBytes']),
        verseCount: asInt(json['verseCount']),
        schemaVersion: asInt(json['schemaVersion'], 1),
      );
}

/// `GET /books/:book/manifest`.
class CacheManifest {
  const CacheManifest({
    required this.bookId,
    required this.bookSlug,
    required this.unitType,
    required this.units,
    required this.fetchedAt,
  });

  final String bookId;
  final String bookSlug;
  final String? unitType;
  final List<ManifestUnit> units;
  final DateTime fetchedAt;

  int get totalUnits => units.length;

  ManifestUnit? byNumber(int number) {
    for (final unit in units) {
      if (unit.number == number) return unit;
    }
    return null;
  }

  factory CacheManifest.fromJson(Json json, {DateTime? now}) => CacheManifest(
        bookId: asString(json['bookId']),
        bookSlug: asString(json['bookSlug']),
        unitType: asStringOrNull(json['unitType']),
        units: asList(json['units'], ManifestUnit.fromJson),
        fetchedAt: now ?? DateTime.now(),
      );
}

/// `POST /books/:book/download-url` — a link good for a few minutes, and the
/// version and hash the downloaded bytes are checked against.
class UnitLink {
  const UnitLink({
    required this.unitId,
    required this.unitType,
    required this.url,
    required this.version,
    required this.hash,
    required this.sizeBytes,
    this.schemaVersion = 1,
  });

  final String unitId;
  final String unitType;
  final String url;
  final int version;
  final String hash;
  final int sizeBytes;
  final int schemaVersion;

  factory UnitLink.fromJson(Json json) => UnitLink(
        unitId: asString(json['unitId']),
        unitType: asString(json['unitType']),
        url: asString(json['presignedUrl']),
        version: asInt(json['version']),
        hash: asString(json['hash']),
        sizeBytes: asInt(json['sizeBytes']),
        schemaVersion: asInt(json['schemaVersion'], 1),
      );
}

// ── The unit's file, parsed ───────────────────────────────────────────────

class PayloadSection {
  const PayloadSection({
    required this.id,
    required this.number,
    required this.title,
    this.cantoNumber,
    this.titleI18n,
    this.summary,
    this.summaryI18n,
    this.totalVerses = 0,
  });

  final String id;
  final int number;
  final int? cantoNumber;
  final String title;
  final Map<String, dynamic>? titleI18n;
  final String? summary;
  final Map<String, dynamic>? summaryI18n;
  final int totalVerses;

  factory PayloadSection.fromJson(Json json) => PayloadSection(
        id: asString(json['id']),
        number: asInt(json['number']),
        cantoNumber: asIntOrNull(json['cantoNumber']),
        title: asString(json['title']),
        titleI18n: asJson(json['titleI18n']),
        summary: asStringOrNull(json['summary']),
        summaryI18n: asJson(json['summaryI18n']),
        totalVerses: asInt(json['totalVerses']),
      );
}

class PayloadTranslation {
  const PayloadTranslation({
    required this.id,
    required this.languageCode,
    required this.type,
    this.translatorId,
    this.translatorSlug,
    this.translatorName,
    this.meaning,
    this.purport,
    this.sourceRef,
    this.audioPath,
    this.displayOrder = 0,
  });

  final String id;
  final String languageCode;
  final String type;
  final String? translatorId;
  final String? translatorSlug;
  final String? translatorName;
  final String? meaning;
  final String? purport;
  final String? sourceRef;
  final String? audioPath;
  final int displayOrder;

  factory PayloadTranslation.fromJson(Json json) => PayloadTranslation(
        id: asString(json['id']),
        languageCode: asString(json['languageCode']),
        type: asString(json['type'], 'TRANSLATION'),
        translatorId: asStringOrNull(json['translatorId']),
        translatorSlug: asStringOrNull(json['translatorSlug']),
        translatorName: asStringOrNull(json['translatorName']),
        meaning: asStringOrNull(json['meaning']),
        purport: asStringOrNull(json['purport']),
        sourceRef: asStringOrNull(json['sourceRef']),
        audioPath: asStringOrNull(json['audioPath']),
        displayOrder: asInt(json['displayOrder']),
      );
}

class PayloadVerse {
  const PayloadVerse({
    required this.id,
    required this.verseId,
    required this.verseNumber,
    this.chapterId,
    this.chapterNumber,
    this.cantoNumber,
    this.verseNumberEnd,
    this.type = 'SHLOKA',
    this.sanskrit,
    this.transliteration,
    this.wordMeaningsJson,
    this.audioPath,
    this.audioUrl,
    this.tags = const [],
    this.translations = const [],
  });

  final String id;
  final String verseId;
  final String? chapterId;
  final int? chapterNumber;
  final int? cantoNumber;
  final int verseNumber;
  final int? verseNumberEnd;
  final String type;
  final String? sanskrit;
  final String? transliteration;

  /// Re-encoded JSON text, as stored.
  final String? wordMeaningsJson;
  final String? audioPath;

  /// Only for a verse saved from an API response, which sends a link.
  final String? audioUrl;
  final List<String> tags;
  final List<PayloadTranslation> translations;

  factory PayloadVerse.fromJson(Json json) {
    final words = json['wordMeanings'];
    return PayloadVerse(
      id: asString(json['id']),
      verseId: asString(json['verseId']),
      chapterId: asStringOrNull(json['chapterId']),
      chapterNumber: asIntOrNull(json['chapterNumber']),
      cantoNumber: asIntOrNull(json['cantoNumber']),
      verseNumber: asInt(json['verseNumber']),
      verseNumberEnd: asIntOrNull(json['verseNumberEnd']),
      type: asString(json['type'], 'SHLOKA'),
      sanskrit: asStringOrNull(json['sanskrit']),
      transliteration: asStringOrNull(json['transliteration']),
      wordMeaningsJson: words is List && words.isNotEmpty ? jsonEncode(words) : null,
      audioPath: asStringOrNull(json['audioPath']),
      tags: asStringList(json['tags']),
      translations: asList(json['translations'], PayloadTranslation.fromJson),
    );
  }
}

/// One unit's file, parsed and checked. This is what `BookDao.replaceUnit` writes.
class UnitPayload {
  const UnitPayload({
    required this.schemaVersion,
    required this.bookId,
    required this.bookSlug,
    required this.bookTitle,
    required this.bookNumber,
    this.bookTitleI18n,
    required this.unitType,
    required this.unit,
    required this.chapters,
    required this.verses,
  });

  final int schemaVersion;
  final String bookId;
  final String bookSlug;
  final String bookTitle;
  final Map<String, dynamic>? bookTitleI18n;
  final int bookNumber;
  final String unitType;

  /// The unit itself — a chapter, or a canto.
  final PayloadSection unit;

  /// The chapters inside it. For a chapter unit, just itself.
  final List<PayloadSection> chapters;
  final List<PayloadVerse> verses;

  factory UnitPayload.fromJson(Json json) {
    final book = asJson(json['book']) ?? const {};
    final unit = asJson(json['unit']) ?? const {};
    return UnitPayload(
      schemaVersion: asInt(json['schemaVersion'], 1),
      bookId: asString(book['id']),
      bookSlug: asString(book['slug']),
      bookTitle: asString(book['title']),
      bookTitleI18n: asJson(book['titleI18n']),
      bookNumber: asInt(book['bookNumber']),
      unitType: asString(unit['type']),
      unit: PayloadSection.fromJson(unit),
      chapters: asList(json['chapters'], PayloadSection.fromJson),
      verses: asList(json['verses'], PayloadVerse.fromJson),
    );
  }
}

/// A downloaded unit that cannot be trusted: wrong hash, unreadable, or newer
/// than this build understands. Never written to the database.
class UnitIntegrityException implements Exception {
  const UnitIntegrityException(this.reason);

  final String reason;

  @override
  String toString() => 'UnitIntegrityException: $reason';
}

/// Unpacks [bytes] if they are gzipped, checks them against [expectedHash],
/// then parses them.
///
/// Top-level and free of anything but its arguments so it can run in an
/// isolate (`compute`): hashing and decoding a canto is tens of milliseconds to
/// a second of work, which is a dropped frame on the UI thread.
UnitPayload verifyAndParseUnit(({Uint8List bytes, String expectedHash, int maxSchema}) args) {
  // The file is stored gzipped. The HTTP stack may already have unpacked it
  // (a Content-Encoding header) or not (a plain-file dev server), so look at the
  // bytes rather than at what was promised. The hash is of the unpacked bytes.
  var bytes = args.bytes;
  if (bytes.length > 2 && bytes[0] == 0x1f && bytes[1] == 0x8b) {
    try {
      bytes = Uint8List.fromList(gzip.decode(bytes));
    } on FormatException catch (error) {
      throw UnitIntegrityException('bad gzip: ${error.message}');
    }
  }
  final actual = sha256.convert(bytes).toString();
  if (actual != args.expectedHash) {
    throw UnitIntegrityException('hash mismatch (expected ${args.expectedHash}, got $actual)');
  }
  final Object? decoded;
  try {
    decoded = jsonDecode(utf8.decode(bytes));
  } on FormatException catch (error) {
    throw UnitIntegrityException('not valid JSON: ${error.message}');
  }
  if (decoded is! Map) throw const UnitIntegrityException('not a JSON object');
  final payload = UnitPayload.fromJson(Map<String, dynamic>.from(decoded));
  if (payload.schemaVersion > args.maxSchema) {
    throw UnitIntegrityException(
      'schema ${payload.schemaVersion} is newer than this app understands (${args.maxSchema})',
    );
  }
  if (payload.bookId.isEmpty || payload.unit.id.isEmpty) {
    throw const UnitIntegrityException('missing book or unit');
  }
  return payload;
}
