import 'package:flutter/material.dart';

import 'json.dart';

/// The verse a book reel draws, already in the reader's reading language by
/// the time it arrives. Any part can be missing (a verse with no purport in
/// that language falls back to the nearest one the API found).
class VerseReelContent {
  const VerseReelContent({
    this.label,
    this.bookTitle,
    this.sanskrit,
    this.transliteration,
    this.meaning,
    this.purport,
  });

  final String? label;
  final String? bookTitle;
  final String? sanskrit;
  final String? transliteration;
  final String? meaning;
  final String? purport;

  bool get hasVerseLines => (sanskrit ?? '').isNotEmpty || (transliteration ?? '').isNotEmpty;

  static VerseReelContent? maybe(Json? json) {
    if (json == null) return null;
    return VerseReelContent(
      label: asStringOrNull(json['label']),
      bookTitle: asStringOrNull(json['bookTitle']),
      sanskrit: asStringOrNull(json['sanskrit']),
      transliteration: asStringOrNull(json['transliteration']),
      meaning: asStringOrNull(json['meaning']),
      purport: asStringOrNull(json['purport']),
    );
  }
}

enum BookReelBackground {
  gradient,
  solid,
  image;

  static BookReelBackground parse(dynamic value) => values.asNameMap()[asString(value)] ?? gradient;
}

/// How book reels look and which buttons they show — set in the admin panel
/// and fetched once. [BookReelStyle.fallback] is what draws until it arrives
/// (and when the request fails), so a reel is never held up by it.
class BookReelStyle {
  const BookReelStyle({
    this.background = BookReelBackground.gradient,
    this.colorTop = const Color(0xFF2B1408),
    this.colorBottom = const Color(0xFF7A3410),
    this.imageUrl,
    this.imageDim = 55,
    this.sanskritColor = const Color(0xFFFFE9B8),
    this.transliterationColor = const Color(0xFFF3D9A4),
    this.meaningColor = const Color(0xFFFFFFFF),
    this.purportColor = const Color(0xFFF4EBDD),
    this.accentColor = const Color(0xFFF2A93B),
    this.textScale = 1,
    this.minPageSeconds = 5,
    this.wordsPerSecond = 3,
    this.showLike = true,
    this.showComments = true,
    this.showSave = true,
    this.showShare = true,
    this.showMore = true,
    this.showReference = true,
  });

  static const BookReelStyle fallback = BookReelStyle();

  final BookReelBackground background;
  final Color colorTop;
  final Color colorBottom;
  final String? imageUrl;

  /// The picture's link without its query: a signed link changes every hour,
  /// the picture behind it does not, so the disk copy is found by this.
  String? get imageCacheKey => imageUrl?.split('?').first;

  /// How much of the picture is covered by a dark wash, 0–90 percent.
  final double imageDim;

  final Color sanskritColor;
  final Color transliterationColor;
  final Color meaningColor;
  final Color purportColor;
  final Color accentColor;
  final double textScale;

  /// A page stays up for its reading time, never less than this.
  final double minPageSeconds;
  final double wordsPerSecond;

  final bool showLike;
  final bool showComments;
  final bool showSave;
  final bool showShare;
  final bool showMore;
  final bool showReference;

  /// Whether the right-hand rail has anything on it; with none, the text takes the full width.
  bool get hasRail => showLike || showComments || showSave || showShare || showMore;

  static Color _color(dynamic value, Color fallback) {
    final text = asString(value);
    final match = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(text);
    if (match == null) return fallback;
    return Color(0xFF000000 | int.parse(match.group(1)!, radix: 16));
  }

  factory BookReelStyle.fromJson(Json json) {
    const base = BookReelStyle.fallback;
    return BookReelStyle(
      background: BookReelBackground.parse(json['background']),
      colorTop: _color(json['colorTop'], base.colorTop),
      colorBottom: _color(json['colorBottom'], base.colorBottom),
      imageUrl: asStringOrNull(json['imageUrl']),
      imageDim: asDouble(json['imageDim'], base.imageDim).clamp(0, 90).toDouble(),
      sanskritColor: _color(json['sanskritColor'], base.sanskritColor),
      transliterationColor: _color(json['transliterationColor'], base.transliterationColor),
      meaningColor: _color(json['meaningColor'], base.meaningColor),
      purportColor: _color(json['purportColor'], base.purportColor),
      accentColor: _color(json['accentColor'], base.accentColor),
      textScale: asDouble(json['textScale'], 1).clamp(0.7, 1.5).toDouble(),
      minPageSeconds: asDouble(json['minPageSeconds'], base.minPageSeconds).clamp(2, 30).toDouble(),
      wordsPerSecond: asDouble(json['wordsPerSecond'], base.wordsPerSecond).clamp(1, 8).toDouble(),
      showLike: asBool(json['showLike'], true),
      showComments: asBool(json['showComments'], true),
      showSave: asBool(json['showSave'], true),
      showShare: asBool(json['showShare'], true),
      showMore: asBool(json['showMore'], true),
      showReference: asBool(json['showReference'], true),
    );
  }
}
