import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/constants/app_config.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/reel.dart';
import '../../providers/reel_provider.dart';
import '../../services/reel_service.dart';
import '../../services/tracking_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/reels/reel_comments_sheet.dart';
import '../../widgets/reels/reel_page.dart';
import '../../widgets/reels/reel_report_sheet.dart';
import '../../widgets/reels/reel_video_player.dart';

/// One reel on its own — what a share link, a deep link or a push notification
/// opens.
///
/// Not the feed with one item in it: there is nothing to swipe to, the reel may
/// not be in the reader's feed at all (it could be their own, or one they have
/// already watched), and it has to work before the feed has ever loaded.
///
/// Engagement is held locally rather than in the feed notifier for the same
/// reason. When the reel *does* happen to be in the loaded feed, the change is
/// mirrored there too, so going back does not show a stale heart.
class ReelDetailView extends ConsumerStatefulWidget {
  const ReelDetailView({super.key, required this.reelId});

  final String reelId;

  @override
  ConsumerState<ReelDetailView> createState() => _ReelDetailViewState();
}

class _ReelDetailViewState extends ConsumerState<ReelDetailView> {
  final GlobalKey<ReelVideoPlayerState> _player = GlobalKey<ReelVideoPlayerState>();

  /// Null until the fetch lands; after that this is the copy the screen shows,
  /// so an optimistic tap has something to move.
  Reel? _reel;
  bool _muted = true;

  @override
  void initState() {
    super.initState();
    TrackingService.instance.log('reel_detail_open', parameters: {'reel_id': widget.reelId});
  }

  @override
  void dispose() {
    _player.currentState?.reportProgress();
    super.dispose();
  }

  void _apply(Reel updated) {
    setState(() => _reel = updated);
    // Keep the feed in step where it already holds this reel.
    ref.read(reelFeedProvider.notifier).replaceIfPresent(updated);
  }

  Future<void> _toggleLike(Reel reel) async {
    final wanted = !reel.isLiked;
    _apply(reel.copyWith(
      isLiked: wanted,
      likeCount: (reel.likeCount + (wanted ? 1 : -1)).clamp(0, 1 << 30),
    ));

    try {
      final result = await ReelService.instance.setLiked(reel.id, wanted);
      final current = _reel;
      if (current != null) {
        _apply(current.copyWith(isLiked: result.isOn, likeCount: result.count));
      }
    } on ApiFailure {
      _apply(reel);
    }
  }

  Future<void> _toggleSave(Reel reel) async {
    final wanted = !reel.isSaved;
    _apply(reel.copyWith(isSaved: wanted));
    try {
      await ReelService.instance.setSaved(reel.id, wanted);
    } on ApiFailure {
      _apply(reel);
    }
  }

  Future<void> _toggleFollow(Reel reel) async {
    final wanted = !reel.isFollowingCreator;
    _apply(reel.copyWith(isFollowingCreator: wanted));
    try {
      await ReelService.instance.setFollowing(reel.creator.id, wanted);
      ref.read(reelFeedProvider.notifier).syncFollow(reel.creator.id, wanted);
    } on ApiFailure {
      _apply(reel);
    }
  }

  Future<void> _share(Reel reel) async {
    final text = AppLocalizations.of(context);
    final link = '${AppConfig.appScheme}://reels/${reel.id}';

    try {
      final result = await SharePlus.instance.share(
        ShareParams(text: text.reelShareMessage(reel.shareLabel, link)),
      );
      if (result.status != ShareResultStatus.success) return;

      final count = await ReelService.instance.recordShare(reel.id, SharePlatform.other);
      final current = _reel ?? reel;
      _apply(current.copyWith(shareCount: count));
    } on ApiFailure {
      // The share itself succeeded; only our count did not.
    }
  }

  void _reportWatch(Reel reel, int watchedMs, int durationMs) {
    ReelService.instance
        .reportView(reel.id, watchedMs: watchedMs, durationMs: durationMs)
        .catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final fetched = ref.watch(reelProvider(widget.reelId));

    return Scaffold(
      backgroundColor: AppColors.reelGround,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: Stack(
          children: [
            fetched.when(
              loading: () => const AppLoader(),
              error: (error, _) => AppErrorView(
                failure: error is ApiFailure
                    ? error
                    : ApiFailure(kind: FailureKind.notFound, message: text.reelsFailed),
                onRetry: () async => ref.invalidate(reelProvider(widget.reelId)),
              ),
              data: (fresh) {
                // The fetched reel seeds the local copy once; every tap after
                // that moves the local one, so a rebuild does not undo it.
                final reel = _reel ?? fresh;
                return ReelPage(
                  reel: reel,
                  playerKey: _player,
                  isActive: true,
                  isMuted: _muted,
                  onProgress: (watched, duration) => _reportWatch(reel, watched, duration),
                  onLike: () => _toggleLike(reel),
                  onSave: () => _toggleSave(reel),
                  onFollow: () => _toggleFollow(reel),
                  onComment: () => ReelCommentsSheet.show(context, reel.id),
                  onShare: () => _share(reel),
                  onMore: () => ReelReportSheet.showForReel(context, reel.id),
                  onCreatorTap: () =>
                      AppNavigator.instance.push(AppRoutes.creatorPath(reel.creator.id)),
                  onToggleMute: () => setState(() => _muted = !_muted),
                );
              },
            ),
            Positioned(
              top: AppSpacing.sm,
              left: AppSpacing.sm,
              child: SafeArea(
                child: IconButton(
                  icon: const Icon(Icons.arrow_back_rounded, color: AppColors.reelInk),
                  tooltip: MaterialLocalizations.of(context).backButtonTooltip,
                  onPressed: () => AppNavigator.instance.pop(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
