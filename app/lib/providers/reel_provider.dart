import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/api_failure.dart';
import '../models/creator.dart';
import '../models/reel.dart';
import '../services/reel_service.dart';
import '../services/tracking_service.dart';

/// How close to the end of what we have before the next page is fetched.
///
/// Three, not one: a reel is swiped in well under a second, and asking for the
/// next page as the last one appears means the reader waits on the network
/// every eleven reels. Fetching three early hides it entirely.
const int _prefetchThreshold = 3;

/// The feed.
///
/// Every engagement tap is **optimistic**: the state moves before the request
/// is sent, and is put back only if the request fails. On a video feed the
/// alternative is visible — a heart that fills a third of a second after it is
/// tapped reads as a dropped tap, and people tap again.
///
/// The server's own count is what the state settles on, not the guess, because
/// other people are liking the same reel at the same time.
class ReelFeedNotifier extends AsyncNotifier<List<Reel>> {
  int _page = 1;
  bool _hasMore = true;
  bool _loadingMore = false;

  @override
  Future<List<Reel>> build() async {
    final page = await ReelService.instance.feed();
    _page = page.page;
    _hasMore = page.hasMore;
    return page.items;
  }

  bool get hasMore => _hasMore;

  Future<void> refresh() async {
    _page = 1;
    _hasMore = true;
    state = await AsyncValue.guard(() async {
      final page = await ReelService.instance.feed();
      _page = page.page;
      _hasMore = page.hasMore;
      return page.items;
    });
  }

  /// Called as the reader moves through the feed. Does nothing until they are
  /// within [_prefetchThreshold] of the end, so it is safe to call on every
  /// page change.
  Future<void> loadMoreIfNeeded(int index) async {
    final current = state.value;
    if (current == null || _loadingMore || !_hasMore) return;
    if (index < current.length - _prefetchThreshold) return;

    _loadingMore = true;
    try {
      final next = await ReelService.instance.feed(page: _page + 1);
      _page = next.page;
      _hasMore = next.hasMore;
      // Guarded against duplicates: the ranking is computed per request, so a
      // reel near a page boundary can legitimately arrive twice.
      final seen = current.map((reel) => reel.id).toSet();
      state = AsyncData([...current, ...next.items.where((reel) => !seen.contains(reel.id))]);
    } on ApiFailure {
      // A failed page is not worth interrupting playback for — the next swipe
      // tries again.
      _hasMore = true;
    } finally {
      _loadingMore = false;
    }
  }

  void _replace(Reel updated) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData([
      for (final reel in current)
        if (reel.id == updated.id) updated else reel,
    ]);
  }

  Reel? byId(String id) {
    final found = state.value?.where((reel) => reel.id == id);
    return (found == null || found.isEmpty) ? null : found.first;
  }

  Future<void> toggleLike(String reelId) async {
    final reel = byId(reelId);
    if (reel == null) return;

    final wanted = !reel.isLiked;
    _replace(reel.copyWith(
      isLiked: wanted,
      likeCount: (reel.likeCount + (wanted ? 1 : -1)).clamp(0, 1 << 30),
    ));

    unawaited(TrackingService.instance.log(
      wanted ? 'reel_like' : 'reel_unlike',
      parameters: {'reel_id': reelId},
    ));

    try {
      final result = await ReelService.instance.setLiked(reelId, wanted);
      final settled = byId(reelId);
      if (settled != null) {
        _replace(settled.copyWith(isLiked: result.isOn, likeCount: result.count));
      }
    } on ApiFailure {
      _replace(reel); // put it back exactly as it was
    }
  }

  Future<void> toggleSave(String reelId) async {
    final reel = byId(reelId);
    if (reel == null) return;

    final wanted = !reel.isSaved;
    _replace(reel.copyWith(isSaved: wanted));
    unawaited(TrackingService.instance.log(
      wanted ? 'reel_save' : 'reel_unsave',
      parameters: {'reel_id': reelId},
    ));

    try {
      await ReelService.instance.setSaved(reelId, wanted);
    } on ApiFailure {
      _replace(reel);
    }
  }

  /// Follow state lives on every reel by that creator, not just the one on
  /// screen — following from one reel and swiping to another by the same
  /// person must not show "Follow" again.
  Future<void> toggleFollow(String creatorId) async {
    final current = state.value;
    if (current == null) return;

    final wanted = !(current.firstWhere((reel) => reel.creator.id == creatorId).isFollowingCreator);

    void apply(bool following) {
      state = AsyncData([
        for (final reel in state.value ?? current)
          if (reel.creator.id == creatorId) reel.copyWith(isFollowingCreator: following) else reel,
      ]);
    }

    apply(wanted);
    unawaited(TrackingService.instance.log(
      wanted ? 'creator_follow' : 'creator_unfollow',
      parameters: {'creator_id': creatorId},
    ));

    try {
      await ReelService.instance.setFollowing(creatorId, wanted);
    } on ApiFailure {
      apply(!wanted);
    }
  }

  /// Writes a reel back into the feed **only if it is already there**.
  ///
  /// The single-reel screen and the creator profile both hold their own copy
  /// of a reel — one the feed may never have loaded. This keeps the two in
  /// step where they overlap, without a reel the feed never had quietly
  /// appearing in it.
  void replaceIfPresent(Reel updated) {
    if (byId(updated.id) == null) return;
    _replace(updated);
  }

  /// Follow state belongs to the creator, not to one reel, so it is written to
  /// every reel of theirs the feed is holding. Called after the profile screen
  /// or the single-reel screen changes it, so backing out to the feed does not
  /// show "Follow" on someone already followed.
  void syncFollow(String creatorId, bool following) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData([
      for (final reel in current)
        if (reel.creator.id == creatorId) reel.copyWith(isFollowingCreator: following) else reel,
    ]);
  }

  /// Called by the comments sheet, so the count under the video matches the
  /// list the reader is looking at without a refetch.
  void adjustCommentCount(String reelId, int delta) {
    final reel = byId(reelId);
    if (reel == null) return;
    _replace(reel.copyWith(commentCount: (reel.commentCount + delta).clamp(0, 1 << 30)));
  }

  void adjustShareCount(String reelId, int count) {
    final reel = byId(reelId);
    if (reel == null) return;
    _replace(reel.copyWith(shareCount: count));
  }
}

final reelFeedProvider =
    AsyncNotifierProvider<ReelFeedNotifier, List<Reel>>(ReelFeedNotifier.new);

/// One reel on its own — the deeplink and share target, which has no feed
/// around it to read from.
final reelProvider = FutureProvider.family.autoDispose<Reel, String>((ref, id) {
  return ReelService.instance.get(id);
});

/// Reels the reader saved.
final savedReelsProvider = FutureProvider.autoDispose<List<Reel>>((ref) async {
  final page = await ReelService.instance.saved();
  return page.items;
});

/// A creator's profile. Not autoDispose: following from the profile and going
/// back to the feed, then returning, should not refetch.
final creatorProvider = FutureProvider.family<Creator, String>((ref, id) {
  return ReelService.instance.creator(id);
});

final creatorReelsProvider = FutureProvider.family.autoDispose<List<Reel>, String>((ref, id) async {
  final page = await ReelService.instance.creatorReels(id);
  return page.items;
});
