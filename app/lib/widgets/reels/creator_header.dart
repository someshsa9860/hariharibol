import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/creator.dart';
import '../common/app_image.dart';
import 'reel_counts.dart';

/// The top of a creator's profile: avatar, name, bio, three numbers, and the
/// follow button.
class CreatorHeader extends StatelessWidget {
  const CreatorHeader({super.key, required this.creator, this.onFollowTap});

  /// Null while a follow request is in flight, which is what disables the
  /// button — a second tap mid-request would fight the optimistic state.
  final VoidCallback? onFollowTap;

  final Creator creator;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Padding(
      padding: AppSpacing.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipOval(
                child: AppImage(
                  url: creator.avatarUrl,
                  cacheKey: creator.id,
                  width: AppSizes.avatarLg,
                  height: AppSizes.avatarLg,
                  borderRadius: BorderRadius.zero,
                ),
              ),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            creator.displayName,
                            style: context.texts.headlineSmall,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (creator.isVerified) ...[
                          const SizedBox(width: AppSpacing.xs),
                          Tooltip(
                            message: text.creatorVerified,
                            child: Icon(
                              Icons.verified_rounded,
                              size: AppSizes.iconSm,
                              color: context.colors.primary,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _Stats(creator: creator),
                  ],
                ),
              ),
            ],
          ),
          if ((creator.bio ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(creator.bio!, style: context.texts.bodyMedium),
          ],
          // Following yourself is refused by the API, so your own profile gets
          // no button rather than one that cannot work.
          if (!creator.isMe) ...[
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: creator.isFollowing
                  ? OutlinedButton.icon(
                      onPressed: onFollowTap,
                      icon: const Icon(Icons.check_rounded, size: AppSizes.iconSm),
                      label: Text(text.reelFollowing),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, AppSizes.buttonHeight),
                      ),
                    )
                  : FilledButton(
                      onPressed: onFollowTap,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, AppSizes.buttonHeight),
                      ),
                      child: Text(text.reelFollow),
                    ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Divider(color: context.colors.outlineVariant),
        ],
      ),
    );
  }
}

/// Followers, reels, views. Serif figures, because they are numbers meant to
/// be looked at rather than read past.
class _Stats extends StatelessWidget {
  const _Stats({required this.creator});

  final Creator creator;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Wrap(
      spacing: AppSpacing.lg,
      runSpacing: AppSpacing.xs,
      children: [
        _Stat(
          value: creator.followerCount,
          caption: text.creatorStatFollowers,
          spoken: text.creatorFollowers(creator.followerCount),
        ),
        _Stat(
          value: creator.reelCount,
          caption: text.creatorStatReels,
          spoken: text.creatorReelCount(creator.reelCount),
        ),
        _Stat(
          value: creator.totalViews,
          caption: text.creatorStatViews,
          spoken: text.creatorViews(creator.totalViews),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.caption, required this.spoken});

  final int value;

  /// The word under the figure — "Followers". Just the noun: the number is
  /// drawn beside it, abbreviated.
  final String caption;

  /// The whole pluralised phrase, with the number unabbreviated. Only a screen
  /// reader gets this — "one thousand two hundred followers" is far better to
  /// listen to than "one point two K".
  final String spoken;

  static const double _figure = 18;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: spoken,
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              compactCount(context, value),
              style: AppTypography.numeral(context, size: _figure),
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(caption, style: context.texts.bodySmall),
          ],
        ),
      ),
    );
  }
}
