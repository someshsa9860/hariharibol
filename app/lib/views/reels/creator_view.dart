import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/creator.dart';
import '../../models/reel.dart';
import '../../providers/reel_provider.dart';
import '../../services/reel_service.dart';
import '../../services/tracking_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_image.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/reels/creator_header.dart';
import '../../widgets/reels/reel_grid_tile.dart';

/// A creator's profile: who they are, and everything they have posted.
///
/// An ordinary app screen on the normal palette, not the reel surface. The
/// black ground belongs to the media itself — a profile is a page to read, and
/// this app already has a considered way of showing one of those.
class CreatorView extends ConsumerWidget {
  const CreatorView({super.key, required this.creatorId});

  final String creatorId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final profile = ref.watch(creatorProvider(creatorId));

    return Scaffold(
      appBar: AppBar(title: Text(profile.value?.displayName ?? text.creatorTitle)),
      body: profile.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure
              ? error
              : ApiFailure(kind: FailureKind.notFound, message: text.creatorNotFound),
          onRetry: () async => ref.invalidate(creatorProvider(creatorId)),
        ),
        data: (creator) => _Body(creator: creator),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.creator});

  final Creator creator;

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  late Creator _creator = widget.creator;
  bool _working = false;

  /// Optimistic, the same as the feed's follow button — and the feed is told
  /// about it too, so going back does not show the old state.
  Future<void> _toggleFollow() async {
    if (_working) return;

    final wanted = !_creator.isFollowing;
    setState(() {
      _working = true;
      _creator = _creator.copyWith(
        isFollowing: wanted,
        followerCount: (_creator.followerCount + (wanted ? 1 : -1)).clamp(0, 1 << 30),
      );
    });

    TrackingService.instance.log(
      wanted ? 'creator_follow' : 'creator_unfollow',
      parameters: {'creator_id': _creator.id, 'from': 'profile'},
    );

    try {
      final result = await ReelService.instance.setFollowing(_creator.id, wanted);
      if (!mounted) return;
      setState(() {
        _creator = _creator.copyWith(isFollowing: result.isOn, followerCount: result.count);
      });
      // The feed holds its own copy of this flag on every reel by this
      // creator; without this, backing out shows "Follow" again.
      ref.read(reelFeedProvider.notifier).syncFollow(_creator.id, result.isOn);
    } on ApiFailure {
      if (mounted) setState(() => _creator = widget.creator);
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final reels = ref.watch(creatorReelsProvider(_creator.id));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(creatorProvider(_creator.id));
        ref.invalidate(creatorReelsProvider(_creator.id));
      },
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: CreatorHeader(
              creator: _creator,
              onFollowTap: _working ? null : _toggleFollow,
            ),
          ),
          reels.when(
            loading: () => const SliverToBoxAdapter(
              child: Padding(padding: AppSpacing.card, child: AppLoader()),
            ),
            error: (error, _) => SliverToBoxAdapter(
              child: Padding(
                padding: AppSpacing.card,
                child: EmptyState(
                  message: error is ApiFailure ? error.message : text.reelsFailed,
                  icon: Icons.error_outline_rounded,
                ),
              ),
            ),
            data: (items) => items.isEmpty
                ? SliverToBoxAdapter(
                    child: EmptyState(
                      message: text.creatorNoReels,
                      icon: Icons.smart_display_outlined,
                    ),
                  )
                : _Grid(reels: items),
          ),
        ],
      ),
    );
  }
}

/// The posted work, three across.
///
/// A grid rather than a list: a profile is browsed by looking, and thumbnails
/// at this size are the only thing that tells one reel from another before it
/// is opened.
class _Grid extends StatelessWidget {
  const _Grid({required this.reels});

  final List<Reel> reels;

  static const int _columns = 3;

  @override
  Widget build(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: _columns,
          mainAxisSpacing: AppSpacing.xs,
          crossAxisSpacing: AppSpacing.xs,
          // Portrait cells, because the media is portrait.
          childAspectRatio: 9 / 16,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) => ReelGridTile(reel: reels[index]),
          childCount: reels.length,
        ),
      ),
    );
  }
}

/// A cover used where a creator has no cover image. Kept here rather than in
/// the header so the header file stays about layout.
class CreatorCover extends StatelessWidget {
  const CreatorCover({super.key, required this.url, required this.cacheKey});

  final String? url;
  final String cacheKey;

  static const double height = 120;

  @override
  Widget build(BuildContext context) {
    if ((url ?? '').isEmpty) {
      return Container(height: height, color: context.colors.surfaceContainerHighest);
    }
    return AppImage(
      url: url,
      cacheKey: cacheKey,
      height: height,
      width: double.infinity,
      borderRadius: BorderRadius.zero,
    );
  }
}
