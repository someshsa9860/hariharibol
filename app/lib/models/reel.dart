import 'json.dart';
import 'reel_overlay.dart';

/// What a reel's media actually is. The three are genuinely different
/// screens — one plays, one is swiped, one is listened to — so the player
/// branches on this rather than guessing from which url happens to be set.
enum ReelMediaType {
  video,
  image,
  audio;

  static ReelMediaType parse(dynamic value) {
    switch (asString(value).toUpperCase()) {
      case 'IMAGE':
        return ReelMediaType.image;
      case 'AUDIO':
        return ReelMediaType.audio;
      default:
        return ReelMediaType.video;
    }
  }
}

/// Where a share ended up. Sent back so the API can answer "which platform
/// actually drives traffic" later — the app never reads it.
enum SharePlatform {
  whatsapp('WHATSAPP'),
  instagram('INSTAGRAM'),
  facebook('FACEBOOK'),
  twitter('TWITTER'),
  telegram('TELEGRAM'),
  copyLink('COPY_LINK'),
  other('OTHER');

  const SharePlatform(this.wire);

  final String wire;
}

/// Why someone flagged a reel or a comment.
enum ReportReason {
  spam('SPAM'),
  harassment('HARASSMENT_OR_ABUSE'),
  nonDevotional('NON_DEVOTIONAL'),
  misinformation('MISINFORMATION'),
  sexualOrViolent('SEXUAL_OR_VIOLENT'),
  other('OTHER');

  const ReportReason(this.wire);

  final String wire;
}

/// One image in an IMAGE reel's slideshow.
class ReelImage {
  const ReelImage({required this.id, required this.imageUrl, this.displayOrder = 0});

  final String id;
  final String imageUrl;
  final int displayOrder;

  factory ReelImage.fromJson(Json json) => ReelImage(
        id: asString(json['id']),
        imageUrl: asString(json['imageUrl']),
        displayOrder: asInt(json['displayOrder']),
      );
}

/// Whoever posted the reel, as it appears on the card.
///
/// Deliberately thinner than [Creator] — the feed only needs enough to draw a
/// name, an avatar and a follow button. Opening the profile fetches the rest.
class ReelCreator {
  const ReelCreator({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    this.isVerified = false,
    this.followerCount = 0,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;
  final bool isVerified;
  final int followerCount;

  factory ReelCreator.fromJson(Json json) => ReelCreator(
        id: asString(json['id']),
        displayName: asString(json['displayName']),
        avatarUrl: asStringOrNull(json['avatarUrl']),
        isVerified: asBool(json['isVerified']),
        followerCount: asInt(json['followerCount']),
      );
}

/// The mantra or deity a reel is about — anything whose label is simply its
/// name. A verse is [ReelVerseRef] instead, because its label is built from
/// numbers and has to go through l10n rather than arriving pre-formatted.
class ReelSubject {
  const ReelSubject({required this.id, required this.name, this.slug});

  final String id;
  final String name;
  final String? slug;

  static ReelSubject? maybe(Json? json) {
    if (json == null) return null;
    return ReelSubject(
      id: asString(json['id']),
      slug: asStringOrNull(json['slug']),
      name: asString(json['name']),
    );
  }
}

/// The verse a reel is about.
///
/// The parts are kept apart rather than joined into "BG 2.47" here: the book
/// abbreviation and the separator are chrome, and chrome goes through l10n.
/// The widget formats it; this only carries the numbers.
class ReelVerseRef {
  const ReelVerseRef({
    required this.id,
    required this.verseId,
    required this.bookNumber,
    required this.chapterNumber,
    required this.verseNumber,
    this.label,
  });

  final String id;

  /// The dotted `book.chapter.verse` id the reading screen is addressed by,
  /// which is not the same as the row's `id`.
  final String verseId;

  final int bookNumber;
  final int chapterNumber;
  final int verseNumber;

  /// How the API cites the verse, book included — "Bhagavad Gita 2.47". Present
  /// on reels made from any book, which is why it is preferred over building a
  /// label from [bookNumber]: the numbers say nothing about which book that is.
  final String? label;

  static ReelVerseRef? maybe(Json? json) {
    if (json == null) return null;
    return ReelVerseRef(
      id: asString(json['id']),
      verseId: asString(json['verseId']),
      bookNumber: asInt(json['bookNumber']),
      chapterNumber: asInt(json['chapterNumber']),
      verseNumber: asInt(json['verseNumber']),
      label: asStringOrNull(json['label']),
    );
  }
}

/// One reel.
///
/// Every count and every "did I already" flag is on the object rather than
/// fetched per card, because the feed is swiped fast and a round trip per
/// reel to find out whether it is liked would show the wrong state for the
/// first second of every single one.
class Reel {
  const Reel({
    required this.id,
    required this.mediaType,
    required this.creator,
    this.videoUrl,
    this.audioUrl,
    this.thumbnailUrl,
    this.media = const [],
    this.durationMs = 0,
    this.width = 0,
    this.height = 0,
    this.caption,
    this.tags = const [],
    this.languageCode,
    this.viewCount = 0,
    this.likeCount = 0,
    this.commentCount = 0,
    this.shareCount = 0,
    this.isLiked = false,
    this.isSaved = false,
    this.isFollowingCreator = false,
    this.isMine = false,
    this.publishedAt,
    this.verse,
    this.mantra,
    this.deity,
    this.overlays = const [],
  });

  final String id;
  final ReelMediaType mediaType;
  final ReelCreator creator;

  final String? videoUrl;

  /// A background track laid over a silent video or a slideshow. Separate from
  /// the video's own audio, which may already be muxed in.
  final String? audioUrl;
  final String? thumbnailUrl;

  /// The slideshow, for an IMAGE reel. Empty for a VIDEO one.
  final List<ReelImage> media;

  final int durationMs;
  final int width;
  final int height;

  final String? caption;
  final List<String> tags;
  final String? languageCode;

  final int viewCount;
  final int likeCount;
  final int commentCount;
  final int shareCount;

  final bool isLiked;
  final bool isSaved;
  final bool isFollowingCreator;

  /// Whether the reader posted this. The feed never returns their own reels,
  /// so this is only ever true on a profile or a followed deep link.
  final bool isMine;

  final DateTime? publishedAt;

  final ReelVerseRef? verse;
  final ReelSubject? mantra;
  final ReelSubject? deity;

  /// Text an admin laid over the media. Drawn by the app, so it stays on top of
  /// whatever the media is and can be re-worded without touching the file.
  final List<ReelOverlay> overlays;

  /// The keys the API puts on every reel it makes from a verse (see the
  /// backend's `utils/reel-tags.js`): where in which book the verse sits. A
  /// reel carrying one of them has siblings worth offering.
  static const List<String> seriesTagPrefixes = ['book:', 'canto:', 'chapter:'];

  /// Whether "more like this" has anything to build on. Hand-made reels carry
  /// only loose hashtags, which are too weak a link to promise a list from.
  bool get hasSimilar => tags.any((tag) => seriesTagPrefixes.any(tag.startsWith));

  /// A track playing under a video or slideshow — as opposed to an audio reel,
  /// whose track *is* the reel.
  bool get hasSoundtrack => !isAudio && (audioUrl ?? '').isNotEmpty;

  bool get isVideo => mediaType == ReelMediaType.video;
  bool get isAudio => mediaType == ReelMediaType.audio;

  /// A video reel with no playable file — the media is still being processed,
  /// or the seed ran without ffmpeg. The player shows the thumbnail rather
  /// than a black rectangle and a spinner that never resolves.
  bool get hasPlayableVideo => isVideo && (videoUrl ?? '').isNotEmpty;

  /// An AUDIO reel whose narration track resolved. Mirrors [hasPlayableVideo]
  /// — the thumbnail stands in while a track is still processing.
  bool get hasPlayableAudio => isAudio && (audioUrl ?? '').isNotEmpty;

  Duration get duration => Duration(milliseconds: durationMs);

  /// Portrait unless the media says otherwise. Used to decide between filling
  /// the screen and letterboxing, so it has to have an answer before the
  /// player has loaded anything.
  double get aspectRatio => (width > 0 && height > 0) ? width / height : 9 / 16;

  /// What the share sheet and the deeplink use.
  String get shareLabel => (caption ?? '').isEmpty ? creator.displayName : caption!;

  factory Reel.fromJson(Json json) => Reel(
        id: asString(json['id']),
        mediaType: ReelMediaType.parse(json['mediaType']),
        creator: ReelCreator.fromJson(asJson(json['creator']) ?? const {}),
        videoUrl: asStringOrNull(json['videoUrl']),
        audioUrl: asStringOrNull(json['audioUrl']),
        thumbnailUrl: asStringOrNull(json['thumbnailUrl']),
        // Sorted through a fresh List, not in place: `asList` hands back a
        // const [] when the field is absent — which is every VIDEO reel — and
        // sorting that throws. It crashes the whole feed's parse, not one card.
        media: _ordered(asList(json['media'], ReelImage.fromJson)),
        durationMs: asInt(json['durationMs']),
        width: asInt(json['width']),
        height: asInt(json['height']),
        caption: asStringOrNull(json['caption']),
        tags: asStringList(json['tags']),
        languageCode: asStringOrNull(json['languageCode']),
        viewCount: asInt(json['viewCount']),
        likeCount: asInt(json['likeCount']),
        commentCount: asInt(json['commentCount']),
        shareCount: asInt(json['shareCount']),
        isLiked: asBool(json['isLiked']),
        isSaved: asBool(json['isSaved']),
        isFollowingCreator: asBool(json['isFollowingCreator']),
        isMine: asBool(json['isMine']),
        publishedAt: asDate(json['publishedAt']),
        verse: ReelVerseRef.maybe(asJson(json['verse'])),
        mantra: ReelSubject.maybe(asJson(json['mantra'])),
        deity: ReelSubject.maybe(asJson(json['deity'])),
        overlays: ReelOverlay.listFrom(json['overlays']),
      );

  static List<ReelImage> _ordered(List<ReelImage> images) {
    if (images.length < 2) return images;
    return List<ReelImage>.of(images)
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
  }

  /// Used for the optimistic updates the action rail depends on: a tap has to
  /// move the icon and the number immediately, and be corrected only if the
  /// request comes back saying otherwise.
  Reel copyWith({
    int? likeCount,
    int? commentCount,
    int? shareCount,
    bool? isLiked,
    bool? isSaved,
    bool? isFollowingCreator,
  }) {
    return Reel(
      id: id,
      mediaType: mediaType,
      creator: creator,
      videoUrl: videoUrl,
      audioUrl: audioUrl,
      thumbnailUrl: thumbnailUrl,
      media: media,
      durationMs: durationMs,
      width: width,
      height: height,
      caption: caption,
      tags: tags,
      languageCode: languageCode,
      viewCount: viewCount,
      likeCount: likeCount ?? this.likeCount,
      commentCount: commentCount ?? this.commentCount,
      shareCount: shareCount ?? this.shareCount,
      isLiked: isLiked ?? this.isLiked,
      isSaved: isSaved ?? this.isSaved,
      isFollowingCreator: isFollowingCreator ?? this.isFollowingCreator,
      isMine: isMine,
      publishedAt: publishedAt,
      verse: verse,
      mantra: mantra,
      deity: deity,
      overlays: overlays,
    );
  }
}
