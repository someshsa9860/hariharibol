import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/reel_comment.dart';
import '../common/app_image.dart';
import 'reel_counts.dart';

/// One comment in the sheet.
///
/// The sheet is an ordinary surface, not the reel's black ground — it sits
/// over the video as a normal sheet, so it uses the app's real palette rather
/// than the overlay tokens. That is deliberate: reading a conversation is
/// reading, and this app has a considered way of doing that already.
class ReelCommentTile extends StatelessWidget {
  const ReelCommentTile({
    super.key,
    required this.comment,
    required this.onLike,
    required this.onReply,
    required this.onMore,
    this.onToggleReplies,
    this.isExpanded = false,
    this.isReply = false,
  });

  final ReelComment comment;
  final VoidCallback onLike;
  final VoidCallback onReply;
  final VoidCallback onMore;

  /// Null on a reply — threads are one level deep, so a reply has none of its
  /// own to open.
  final VoidCallback? onToggleReplies;
  final bool isExpanded;
  final bool isReply;

  /// How far a reply is indented. One step only — see the one-level rule.
  static const double _indent = AppSizes.avatarSm + AppSpacing.md;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final avatar = isReply ? AppSizes.iconMd : AppSizes.avatarSm;

    return Padding(
      padding: EdgeInsets.only(
        left: isReply ? _indent : 0,
        top: AppSpacing.md,
        bottom: AppSpacing.xs,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipOval(
            child: AppImage(
              url: comment.author?.avatarUrl,
              cacheKey: comment.author?.id,
              width: avatar,
              height: avatar,
              borderRadius: BorderRadius.zero,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        comment.author?.name ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.texts.labelLarge,
                      ),
                    ),
                    if (comment.isPinned) ...[
                      const SizedBox(width: AppSpacing.xs),
                      // Icon and word together — colour alone is never allowed
                      // to carry a state in this app.
                      Icon(
                        Icons.push_pin_rounded,
                        size: AppSizes.iconSm,
                        color: context.colors.onSurfaceVariant,
                      ),
                      const SizedBox(width: AppSpacing.xxs),
                      Text(text.reelCommentPinned, style: context.texts.bodySmall),
                    ],
                  ],
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  comment.text ?? text.reelCommentRemoved,
                  style: comment.isHidden
                      ? context.texts.bodyMedium?.copyWith(
                          fontStyle: FontStyle.italic,
                          color: context.colors.onSurfaceVariant,
                        )
                      : context.texts.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    _Action(label: text.reelCommentReply, onTap: onReply),
                    const SizedBox(width: AppSpacing.lg),
                    _Action(label: text.reelCommentReport, onTap: onMore, isMore: true),
                  ],
                ),
                if (!isReply && comment.hasReplies)
                  _Action(
                    label: isExpanded
                        ? text.reelHideReplies
                        : text.reelViewReplies(comment.replyCount),
                    onTap: onToggleReplies ?? () {},
                    isThread: true,
                  ),
              ],
            ),
          ),
          _LikeButton(comment: comment, onTap: onLike),
        ],
      ),
    );
  }
}

/// A small text action under a comment. Text rather than an icon because three
/// unlabelled glyphs under every comment is noise, and these are read rarely.
class _Action extends StatelessWidget {
  const _Action({
    required this.label,
    required this.onTap,
    this.isMore = false,
    this.isThread = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool isMore;
  final bool isThread;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isThread) ...[
              SizedBox(
                width: AppSpacing.xl,
                child: Divider(color: context.colors.outlineVariant),
              ),
              const SizedBox(width: AppSpacing.sm),
            ],
            Text(
              label,
              style: context.texts.labelMedium?.copyWith(
                color: context.colors.onSurfaceVariant,
                fontWeight: isMore ? FontWeight.w500 : FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LikeButton extends StatelessWidget {
  const _LikeButton({required this.comment, required this.onTap});

  final ReelComment comment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Semantics(
      button: true,
      selected: comment.isLiked,
      label: comment.isLiked ? text.reelUnlike : text.reelLike,
      child: ExcludeSemantics(
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  comment.isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  size: AppSizes.iconSm,
                  color: comment.isLiked
                      ? context.colors.primary
                      : context.colors.onSurfaceVariant,
                ),
                if (comment.likeCount > 0) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    compactCount(context, comment.likeCount),
                    style: context.texts.bodySmall,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
