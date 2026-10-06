import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/constants/app_config.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/reel.dart';
import '../../providers/reel_provider.dart';
import '../../services/reel_service.dart';

/// What a reader does to a reel on a screen that holds its own copy of it —
/// like, save, follow, share, and the watch report.
///
/// The feed does this through its notifier because it owns the list. A single
/// reel and a "more like this" run are different: they fetch their reels
/// themselves, so each holds the copies in its own state and a tap has to move
/// *that* copy. A screen mixes this in and says where its copies live
/// ([reelById], [putReel]); the optimistic move, the request and the put-it-back
/// on failure are the same for all of them.
///
/// Every change is mirrored to the feed where the feed already holds the reel,
/// so backing out does not show a stale heart.
mixin ReelActions<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  /// This screen's copy of the reel, or null if it does not hold one.
  Reel? reelById(String id);

  /// Replaces this screen's copy of [updated]'s reel. Calls `setState`.
  void putReel(Reel updated);

  /// Follow state belongs to the creator, not the reel: a screen holding
  /// several reels by one person overrides this to update them all.
  void putFollowing(Reel reel, bool following) => putReel(reel.copyWith(isFollowingCreator: following));

  void _apply(Reel updated) {
    putReel(updated);
    ref.read(reelFeedProvider.notifier).replaceIfPresent(updated);
  }

  Future<void> toggleLike(Reel reel) async {
    final wanted = !reel.isLiked;
    _apply(reel.copyWith(
      isLiked: wanted,
      likeCount: (reel.likeCount + (wanted ? 1 : -1)).clamp(0, 1 << 30),
    ));

    try {
      final result = await ReelService.instance.setLiked(reel.id, wanted);
      final current = reelById(reel.id);
      if (current != null) {
        _apply(current.copyWith(isLiked: result.isOn, likeCount: result.count));
      }
    } on ApiFailure {
      _apply(reel);
    }
  }

  Future<void> toggleSave(Reel reel) async {
    final wanted = !reel.isSaved;
    _apply(reel.copyWith(isSaved: wanted));
    try {
      await ReelService.instance.setSaved(reel.id, wanted);
    } on ApiFailure {
      _apply(reel);
    }
  }

  Future<void> toggleFollow(Reel reel) async {
    final wanted = !reel.isFollowingCreator;
    putFollowing(reel, wanted);
    try {
      await ReelService.instance.setFollowing(reel.creator.id, wanted);
      ref.read(reelFeedProvider.notifier).syncFollow(reel.creator.id, wanted);
    } on ApiFailure {
      putFollowing(reel, !wanted);
    }
  }

  Future<void> shareReel(Reel reel) async {
    final text = AppLocalizations.of(context);
    final link = '${AppConfig.appScheme}://reels/${reel.id}';

    try {
      final result = await SharePlus.instance.share(
        ShareParams(text: text.reelShareMessage(reel.shareLabel, link)),
      );
      if (result.status != ShareResultStatus.success) return;

      final count = await ReelService.instance.recordShare(reel.id, SharePlatform.other);
      final current = reelById(reel.id) ?? reel;
      _apply(current.copyWith(shareCount: count));
    } on ApiFailure {
      // The share itself succeeded; only our count did not.
    }
  }

  void reportWatch(Reel reel, int watchedMs, int durationMs) {
    ReelService.instance
        .reportView(reel.id, watchedMs: watchedMs, durationMs: durationMs)
        .catchError((_) {});
  }
}
