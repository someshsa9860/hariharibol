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
import '../../widgets/common/empty_state.dart';
import '../../widgets/reels/reel_comments_sheet.dart';
import '../../widgets/reels/reel_page.dart';
import '../../widgets/reels/reel_report_sheet.dart';
import '../../widgets/reels/reel_video_player.dart';

/// The reels feed.
///
/// A vertical `PageView`, one reel per page. Pushed from the nav bar's action
/// circle with the bar kept out of view — the same treatment the chant counter
/// gets, and for the same reason: this is a mode, not a tab.
///
/// Two things this screen owns that nothing below it can:
///
///   - **Only one reel plays.** `isActive` is passed down per page and every
///     other player pauses itself. Without that, three pages' worth of video
///     decode at once and the device heats up inside a minute.
///   - **The watch report.** A reel reports how far it got when it is swiped
///     past, and the last one reports when the screen closes — otherwise the
///     reel someone actually watched to the end is the one that never counts.
class ReelsView extends ConsumerStatefulWidget {
  const ReelsView({super.key});

  @override
  ConsumerState<ReelsView> createState() => _ReelsViewState();
}

class _ReelsViewState extends ConsumerState<ReelsView>
    with WidgetsBindingObserver {
  final PageController _pages = PageController();

  /// One key per reel id, so the view can reach the active player to report a
  /// watch without the player having to call back up on every frame.
  final Map<String, GlobalKey<ReelVideoPlayerState>> _playerKeys = {};

  int _index = 0;

  /// The feed as of the last build. `dispose()` needs the current reel's id
  /// to report its watch, but `ref` is unsafe to read once the widget is
  /// unmounting — so this plain field stands in for `ref.read` there.
  List<Reel> _reels = const <Reel>[];

  /// Sound off until the reader asks for it. A feed that starts talking the
  /// moment it opens is the single most complained-about behaviour in this
  /// kind of screen, and the mute button says plainly which state it is in.
  bool _muted = true;

  /// Paused because the app went to the background or something was pushed
  /// over the feed. Separate from the per-reel pause so returning resumes the
  /// reel rather than restarting the feed.
  bool _suspended = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    TrackingService.instance.log('reels_open');
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final suspended = state != AppLifecycleState.resumed;
    if (suspended == _suspended) return;
    setState(() => _suspended = suspended);
  }

  @override
  void dispose() {
    // The reel on screen when the feed closes has not been swiped past, so
    // this is its only chance to report what was watched.
    _playerKeys[_currentReelId]?.currentState?.reportProgress();
    WidgetsBinding.instance.removeObserver(this);
    _pages.dispose();
    super.dispose();
  }

  String get _currentReelId => _index < _reels.length ? _reels[_index].id : '';

  GlobalKey<ReelVideoPlayerState> _keyFor(String reelId) =>
      _playerKeys.putIfAbsent(reelId, () => GlobalKey<ReelVideoPlayerState>());

  void _onPageChanged(int index) {
    setState(() => _index = index);
    ref.read(reelFeedProvider.notifier).loadMoreIfNeeded(index);

    if (index < _reels.length) {
      TrackingService.instance.log(
        'reel_view',
        parameters: {'reel_id': _reels[index].id},
      );
    }
  }

  /// A watch, reported once per reel as it leaves the screen.
  ///
  /// Fire-and-forget: a dropped view event is not worth a message to someone
  /// who is watching a video, and the next one will land.
  void _reportWatch(Reel reel, int watchedMs, int durationMs) {
    ReelService.instance
        .reportView(reel.id, watchedMs: watchedMs, durationMs: durationMs)
        .catchError((_) {});
  }

  Future<void> _share(Reel reel) async {
    final text = AppLocalizations.of(context);
    final link = '${AppConfig.appScheme}://reels/${reel.id}';

    try {
      final result = await SharePlus.instance.share(
        ShareParams(text: text.reelShareMessage(reel.shareLabel, link)),
      );
      // Only counted when the sheet says something actually happened —
      // opening a share sheet and backing out of it is not a share.
      if (result.status != ShareResultStatus.success) return;

      final count = await ReelService.instance.recordShare(
        reel.id,
        SharePlatform.other,
      );
      ref.read(reelFeedProvider.notifier).adjustShareCount(reel.id, count);
      TrackingService.instance.log(
        'reel_share',
        parameters: {'reel_id': reel.id},
      );
    } on ApiFailure {
      // The share itself succeeded; only our count did not.
    }
  }

  Future<void> _copyLink(Reel reel) async {
    final text = AppLocalizations.of(context);
    await Clipboard.setData(
      ClipboardData(text: '${AppConfig.appScheme}://reels/${reel.id}'),
    );
    AppNavigator.instance.showMessage(text.reelLinkCopied);

    try {
      final count = await ReelService.instance.recordShare(
        reel.id,
        SharePlatform.copyLink,
      );
      ref.read(reelFeedProvider.notifier).adjustShareCount(reel.id, count);
    } on ApiFailure {
      // Same as above — the link is on the clipboard either way.
    }
  }

  Future<void> _more(Reel reel) async {
    final text = AppLocalizations.of(context);

    await showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.link_rounded),
              title: Text(text.reelCopyLink),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _copyLink(reel);
              },
            ),
            if (!reel.isMine)
              ListTile(
                leading: const Icon(Icons.flag_outlined),
                title: Text(text.reelReportTitle),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  ReelReportSheet.showForReel(context, reel.id);
                },
              ),
          ],
        ),
      ),
    );
  }

  void _openSubject(Reel reel) {
    final mantra = reel.mantra;
    if (mantra?.slug != null) {
      AppNavigator.instance.push(AppRoutes.mantraPath(mantra!.slug!));
    }
    // A verse opens the reading screen, which another part of the app owns —
    // until that route exists the chip is shown without a destination rather
    // than linking somewhere wrong.
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final feed = ref.watch(reelFeedProvider);
    final notifier = ref.read(reelFeedProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.reelGround,
      // The media runs under the status bar — that is the point of a reel —
      // so the bar's icons are forced light over it in both themes.
      extendBodyBehindAppBar: true,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: Stack(
          children: [
            feed.when(
              loading: () => const AppLoader(),
              error: (error, _) => AppErrorView(
                failure: error is ApiFailure
                    ? error
                    : ApiFailure(
                        kind: FailureKind.unknown,
                        message: text.reelsFailed,
                      ),
                onRetry: notifier.refresh,
              ),
              data: (reels) {
                _reels = reels;
                return reels.isEmpty
                    ? Center(
                        child: EmptyState(
                          message: text.reelsEmptyBody,
                          icon: Icons.smart_display_outlined,
                        ),
                      )
                    : PageView.builder(
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
                            onProgress: (watched, duration) =>
                                _reportWatch(reel, watched, duration),
                            onLike: () => notifier.toggleLike(reel.id),
                            onSave: () => notifier.toggleSave(reel.id),
                            onFollow: () =>
                                notifier.toggleFollow(reel.creator.id),
                            onComment: () =>
                                ReelCommentsSheet.show(context, reel.id),
                            onShare: () => _share(reel),
                            onMore: () => _more(reel),
                            onCreatorTap: () => AppNavigator.instance.push(
                              AppRoutes.creatorPath(reel.creator.id),
                            ),
                            onToggleMute: () =>
                                setState(() => _muted = !_muted),
                            onSubjectTap: reel.mantra?.slug == null
                                ? null
                                : _openSubject,
                            onSimilarTap: reel.hasSimilar
                                ? () => AppNavigator.instance.push(
                                      AppRoutes.similarPath(reel.id),
                                    )
                                : null,
                          );
                        },
                      );
              },
            ),

            // Drawn over the feed rather than in an AppBar: an AppBar would
            // reserve height at the top of a screen whose whole point is that
            // the media reaches the edges.
            Positioned(
              top: AppSpacing.sm,
              left: AppSpacing.sm,
              child: SafeArea(
                child: IconButton(
                  icon: const Icon(
                    Icons.close_rounded,
                    color: AppColors.reelInk,
                  ),
                  tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
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
