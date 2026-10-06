import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/reel.dart';
import '../../providers/reel_provider.dart';
import '../../services/tracking_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/reels/reel_comments_sheet.dart';
import '../../widgets/reels/reel_page.dart';
import '../../widgets/reels/reel_report_sheet.dart';
import '../../widgets/reels/reel_video_player.dart';
import 'reel_actions.dart';

/// Reels like the one the reader was watching: the same chapter first, then the
/// same canto, then the same book.
///
/// A short run that ends, not the feed — so it fetches one page and holds the
/// copies itself (see [ReelActions]). Everything else is the feed's behaviour:
/// one reel plays at a time, a watch is reported as each reel is swiped past,
/// and the last is reported when the screen closes.
class SimilarReelsView extends ConsumerStatefulWidget {
  const SimilarReelsView({super.key, required this.reelId});

  /// The reel this list is "like". It is never in the list itself.
  final String reelId;

  @override
  ConsumerState<SimilarReelsView> createState() => _SimilarReelsViewState();
}

class _SimilarReelsViewState extends ConsumerState<SimilarReelsView>
    with WidgetsBindingObserver, ReelActions<SimilarReelsView> {
  final PageController _pages = PageController();
  final Map<String, GlobalKey<ReelVideoPlayerState>> _playerKeys = {};

  /// Seeded from the fetch once; every tap after that moves these copies, so a
  /// rebuild does not undo it.
  List<Reel>? _reels;
  int _index = 0;
  bool _muted = true;
  bool _suspended = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    TrackingService.instance.log('reels_similar_open', parameters: {'reel_id': widget.reelId});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final suspended = state != AppLifecycleState.resumed;
    if (suspended == _suspended) return;
    setState(() => _suspended = suspended);
  }

  @override
  void dispose() {
    final reels = _reels;
    if (reels != null && _index < reels.length) {
      _playerKeys[reels[_index].id]?.currentState?.reportProgress();
    }
    WidgetsBinding.instance.removeObserver(this);
    _pages.dispose();
    super.dispose();
  }

  GlobalKey<ReelVideoPlayerState> _keyFor(String reelId) =>
      _playerKeys.putIfAbsent(reelId, () => GlobalKey<ReelVideoPlayerState>());

  void _onPageChanged(int index) {
    setState(() => _index = index);
    final reels = _reels;
    if (reels != null && index < reels.length) {
      TrackingService.instance.log('reel_view', parameters: {'reel_id': reels[index].id});
    }
  }

  @override
  Reel? reelById(String id) {
    final found = _reels?.where((reel) => reel.id == id);
    return (found == null || found.isEmpty) ? null : found.first;
  }

  @override
  void putReel(Reel updated) {
    final current = _reels;
    if (current == null) return;
    setState(() {
      _reels = [
        for (final reel in current)
          if (reel.id == updated.id) updated else reel,
      ];
    });
  }

  @override
  void putFollowing(Reel reel, bool following) {
    final current = _reels;
    if (current == null) return;
    setState(() {
      _reels = [
        for (final other in current)
          if (other.creator.id == reel.creator.id) other.copyWith(isFollowingCreator: following) else other,
      ];
    });
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final fetched = ref.watch(similarReelsProvider(widget.reelId));

    return Scaffold(
      backgroundColor: AppColors.reelGround,
      extendBodyBehindAppBar: true,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: Stack(
          children: [
            fetched.when(
              loading: () => const AppLoader(),
              error: (error, _) => AppErrorView(
                failure: error is ApiFailure
                    ? error
                    : ApiFailure(kind: FailureKind.unknown, message: text.reelsFailed),
                onRetry: () async => ref.invalidate(similarReelsProvider(widget.reelId)),
              ),
              data: (fresh) {
                final reels = _reels ??= fresh;
                if (reels.isEmpty) {
                  return Center(
                    child: EmptyState(message: text.reelSimilarEmpty, icon: Icons.smart_display_outlined),
                  );
                }
                return PageView.builder(
                  controller: _pages,
                  scrollDirection: Axis.vertical,
                  onPageChanged: _onPageChanged,
                  itemCount: reels.length,
                  itemBuilder: (context, index) {
                    final reel = reels[index];
                    return ReelPage(
                      key: ValueKey(reel.id),
                      reel: reel,
                      playerKey: _keyFor(reel.id),
                      isActive: index == _index && !_suspended,
                      isMuted: _muted,
                      onProgress: (watched, duration) => reportWatch(reel, watched, duration),
                      onLike: () => toggleLike(reel),
                      onSave: () => toggleSave(reel),
                      onFollow: () => toggleFollow(reel),
                      onComment: () => ReelCommentsSheet.show(context, reel.id),
                      onShare: () => shareReel(reel),
                      onMore: () => ReelReportSheet.showForReel(context, reel.id),
                      onCreatorTap: () => AppNavigator.instance.push(AppRoutes.creatorPath(reel.creator.id)),
                      onToggleMute: () => setState(() => _muted = !_muted),
                      // No "more like this" here: this list is that.
                    );
                  },
                );
              },
            ),
            Positioned(
              top: AppSpacing.sm,
              left: AppSpacing.sm,
              right: AppSpacing.sm,
              child: SafeArea(
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_rounded, color: AppColors.reelInk),
                      tooltip: MaterialLocalizations.of(context).backButtonTooltip,
                      onPressed: () => AppNavigator.instance.pop(),
                    ),
                    Text(
                      text.reelSimilar,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: AppColors.reelInk,
                            shadows: const [Shadow(color: AppColors.reelScrimStrong, blurRadius: 8)],
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
