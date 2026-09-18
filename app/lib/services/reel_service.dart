import '../core/constants/api_paths.dart';
import '../models/creator.dart';
import '../models/json.dart';
import '../models/paged.dart';
import '../models/reel.dart';
import '../models/reel_comment.dart';
import 'api_client.dart';

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
    final response = await _api.get(
      ApiPaths.reels,
      query: {'page': page, 'pageSize': ?pageSize},
    );
    return Paged.fromResponse(response.data, response.meta, Reel.fromJson);
  }

  Future<Reel> get(String id) async {
    final response = await _api.get(ApiPaths.reel(id));
    return Reel.fromJson(response.json);
  }

  Future<Paged<Reel>> saved({int page = 1}) async {
    final response = await _api.get(ApiPaths.savedReels, query: {'page': page});
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
    final response = await _api.get(
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
    final response = await _api.get(ApiPaths.creator(id));
    return Creator.fromJson(response.json);
  }

  Future<Paged<Reel>> creatorReels(String id, {int page = 1}) async {
    final response = await _api.get(ApiPaths.creatorReels(id), query: {'page': page});
    return Paged.fromResponse(response.data, response.meta, Reel.fromJson);
  }

  Future<Paged<Creator>> following({int page = 1}) async {
    final response = await _api.get(ApiPaths.creators, query: {'page': page});
    return Paged.fromResponse(response.data, response.meta, Creator.fromJson);
  }

  Future<ToggleResult> setFollowing(String creatorId, bool following) async {
    final path = ApiPaths.creatorFollow(creatorId);
    final response = following ? await _api.post(path) : await _api.delete(path);
    return ToggleResult.fromJson(response.json, flag: 'isFollowing', counter: 'followerCount');
  }
}
