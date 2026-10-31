import 'dart:io';
import 'dart:typed_data';

import '../core/constants/api_paths.dart';
import '../models/book_reel.dart';
import '../models/creator.dart';
import '../models/json.dart';
import '../models/paged.dart';
import '../models/reel.dart';
import '../models/reel_comment.dart';
import 'api_client.dart';
import 'response_cache.dart';

/// The result of a like, save or follow tap.
///
/// The server is the one that decides what the count actually is — the tap
/// moved it optimistically, and this is what the provider reconciles against.
class ToggleResult {
  const ToggleResult({required this.isOn, required this.count});

  final bool isOn;
  final int count;

  factory ToggleResult.fromJson(Json json, {required String flag, required String counter}) =>
      ToggleResult(isOn: asBool(json[flag]), count: asInt(json[counter]));
}

/// Everything the reels section asks the API for.
///
/// One service for reels, their comments and their creators, because they are
/// one feature — splitting them into three would mean three files that are
/// always opened together.
class ReelService {
  ReelService._();

  static final ReelService instance = ReelService._();

  final ApiClient _api = ApiClient.instance;

  // ── The feed ───────────────────────────────────────────────────────────────

  Future<Paged<Reel>> feed({int page = 1, int? pageSize}) async {
    final response = await _api.getOrSaved(
      ApiPaths.reels,
      query: {'page': page, 'pageSize': ?pageSize},
    );
    return Paged.fromResponse(response.data, response.meta, Reel.fromJson);
  }

  // ── Making a reel ──────────────────────────────────────────────────────────

  /// Sends one file (the share card, or a music file) and returns the key to
  /// name in [make].
  Future<String> uploadMedia({required bool audio, required Uint8List bytes, required String contentType}) async {
    final response = await _api.postBytes(
      '${ApiPaths.reelMedia}?kind=${audio ? 'audio' : 'image'}',
      bytes,
      contentType: contentType,
    );
    return asString(response.json['key']);
  }

  /// Publishes the reel. The reader becomes an approved creator on the spot, so
  /// it is live for everyone as soon as this answers.
  Future<String> make({
    required String imageKey,
    String? audioKey,
    String? caption,
    String? mantraSlug,
    String? languageCode,
  }) async {
    final response = await _api.post(ApiPaths.reelMake, body: {
      'imageKey': imageKey,
      'audioKey': ?audioKey,
      if (caption != null && caption.isNotEmpty) 'caption': caption,
      'mantraSlug': ?mantraSlug,
      'languageCode': ?languageCode,
    });
    return asString(response.json['id']);
  }

  /// Reads a music file from the phone and sends it.
  Future<String> uploadMusicFile(String path, String contentType) async =>
      uploadMedia(audio: true, bytes: await File(path).readAsBytes(), contentType: contentType);

  Future<Reel> get(String id) async {
    final response = await _api.getOrSaved(ApiPaths.reel(id));
    return Reel.fromJson(response.json);
  }

  /// Reels from the same chapter, canto or book as [id], nearest first.
  Future<Paged<Reel>> similar(String id, {int page = 1, int? pageSize}) async {
    final response = await _api.getOrSaved(
      ApiPaths.reelSimilar(id),
      query: {'page': page, 'pageSize': ?pageSize},
    );
    return Paged.fromResponse(response.data, response.meta, Reel.fromJson);
  }

  /// How book reels look and which buttons they show.
  Future<BookReelStyle> bookStyle() async {
    final response = await _api.getOrSaved(ApiPaths.reelBookStyle);
    return BookReelStyle.fromJson(response.json);
  }

  /// The book reels of [verseId]'s book in reading order, starting at that verse.
  Future<Paged<Reel>> fromVerse(String verseId, {int page = 1, int? pageSize}) async {
    final response = await _api.getOrSaved(
      ApiPaths.reelsFromVerse(verseId),
      query: {'page': page, 'pageSize': ?pageSize},
    );
    return Paged.fromResponse(response.data, response.meta, Reel.fromJson);
  }

  Future<Paged<Reel>> saved({int page = 1}) async {
    final response = await _api.getOrSaved(ApiPaths.savedReels, query: {'page': page});
    return Paged.fromResponse(response.data, response.meta, Reel.fromJson);
  }

  // ── Engagement ─────────────────────────────────────────────────────────────

  Future<ToggleResult> setLiked(String reelId, bool liked) async {
    final path = ApiPaths.reelLike(reelId);
    final response = liked ? await _api.post(path) : await _api.delete(path);
    return ToggleResult.fromJson(response.json, flag: 'isLiked', counter: 'likeCount');
  }

  /// Reports how far the reader got. Called when a reel leaves the screen, not
  /// while it plays — the API takes the furthest point rather than a stream of
  /// progress events, so one call per watch is all it wants.
  Future<void> reportView(String reelId, {required int watchedMs, int? durationMs}) {
    return _api.post(
      ApiPaths.reelView(reelId),
      body: {'watchedMs': watchedMs, 'durationMs': ?durationMs},
    );
  }

  Future<int> recordShare(String reelId, SharePlatform platform) async {
    final response = await _api.post(
      ApiPaths.reelShare(reelId),
      body: {'platform': platform.wire},
    );
    return asInt(response.json['shareCount']);
  }

  Future<void> report(String reelId, ReportReason reason, {String? note}) {
    return _api.post(
      ApiPaths.reelReport(reelId),
      body: {'reason': reason.wire, if (note != null && note.isNotEmpty) 'note': note},
    );
  }

  /// Saving is an ordinary bookmark, so it goes through the favourites
  /// endpoint rather than one of its own — see the Favorite model.
  Future<void> setSaved(String reelId, bool saved) async {
    if (saved) {
      await _api.post(ApiPaths.favorites, body: {'reelId': reelId});
      return;
    }
    // Unsaving needs the favourite's own id, which the reel does not carry.
    // Cheaper to look it up in the saved list than to widen every reel in the
    // feed by a field used on one tap.
    final response = await _api.get(ApiPaths.favorites, query: {'type': 'reel'});
    for (final item in response.list.whereType<Map>()) {
      final row = Map<String, dynamic>.from(item);
      if (asJson(row['reel'])?['id'] == reelId) {
        await _api.delete(ApiPaths.favorite(asString(row['id'])));
        return;
      }
    }
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  /// Without [parentId], the top of the thread. With one, that comment's
  /// replies — the same endpoint, which is why this is one method.
  Future<Paged<ReelComment>> comments(String reelId, {String? parentId, int page = 1}) async {
    final response = await _api.getOrSaved(
      ApiPaths.reelComments,
      query: {'reelId': reelId, 'parentId': ?parentId, 'page': page},
    );
    return Paged.fromResponse(response.data, response.meta, ReelComment.fromJson);
  }

  Future<ReelComment> addComment(String reelId, String text, {String? parentId}) async {
    final response = await _api.post(
      ApiPaths.reelComments,
      body: {'reelId': reelId, 'text': text, 'parentId': ?parentId},
    );
    return ReelComment.fromJson(response.json);
  }

  Future<void> deleteComment(String commentId) => _api.delete(ApiPaths.reelComment(commentId));

  Future<ToggleResult> setCommentLiked(String commentId, bool liked) async {
    final path = ApiPaths.reelCommentLike(commentId);
    final response = liked ? await _api.post(path) : await _api.delete(path);
    return ToggleResult.fromJson(response.json, flag: 'isLiked', counter: 'likeCount');
  }

  Future<bool> togglePin(String commentId) async {
    final response = await _api.post(ApiPaths.reelCommentPin(commentId));
    return asBool(response.json['isPinned']);
  }

  Future<void> reportComment(String commentId, ReportReason reason, {String? note}) {
    return _api.post(
      ApiPaths.reelCommentReport(commentId),
      body: {'reason': reason.wire, if (note != null && note.isNotEmpty) 'note': note},
    );
  }

  // ── Creators ───────────────────────────────────────────────────────────────

  Future<Creator> creator(String id) async {
    final response = await _api.getOrSaved(ApiPaths.creator(id));
    return Creator.fromJson(response.json);
  }

  Future<Paged<Reel>> creatorReels(String id, {int page = 1}) async {
    final response = await _api.getOrSaved(ApiPaths.creatorReels(id), query: {'page': page});
    return Paged.fromResponse(response.data, response.meta, Reel.fromJson);
  }

  Future<Paged<Creator>> following({int page = 1}) async {
    final response = await _api.getOrSaved(ApiPaths.creators, query: {'page': page});
    return Paged.fromResponse(response.data, response.meta, Creator.fromJson);
  }

  Future<ToggleResult> setFollowing(String creatorId, bool following) async {
    final path = ApiPaths.creatorFollow(creatorId);
    final response = following ? await _api.post(path) : await _api.delete(path);
    return ToggleResult.fromJson(response.json, flag: 'isFollowing', counter: 'followerCount');
  }
}
