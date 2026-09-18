import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/reel.dart';
import '../common/app_image.dart';

/// The block along the bottom of a reel: who posted it, what they said, and
/// what it is about.
///
/// The caption collapses to two lines with a "more" affordance rather than
/// being truncated outright. A reel's caption is often the verse itself, and
/// silently cutting a verse in half is not something this app should do.
class ReelCaption extends StatefulWidget {
  const ReelCaption({
    super.key,
    required this.reel,
    required this.onCreatorTap,
    required this.onFollowTap,
    this.onSubjectTap,
  });

  final Reel reel;
  final VoidCallback onCreatorTap;
  final VoidCallback onFollowTap;

  /// Opens the verse or mantra the reel is about. Null where there is no
  /// screen to open — the chip is not drawn at all then, rather than drawn
  /// dead.
  final void Function(Reel reel)? onSubjectTap;

  @override
  State<ReelCaption> createState() => _ReelCaptionState();
}

class _ReelCaptionState extends State<ReelCaption> {
  bool _expanded = false;

  static const int _collapsedLines = 2;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final reel = widget.reel;
    final caption = reel.caption ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _CreatorRow(
          reel: reel,
          onTap: widget.onCreatorTap,
          onFollowTap: widget.onFollowTap,
        ),
        if (caption.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          GestureDetector(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Text(
              caption,
              maxLines: _expanded ? null : _collapsedLines,
              overflow: _expanded ? null : TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.reelInk,
                    shadows: const [
                      Shadow(color: AppColors.reelScrimStrong, blurRadius: 8),
                    ],
                  ),
            ),
          ),
          // Only offered when there is actually something hidden. Measuring
          // the text to know that costs a layout pass on every frame of a
          // video; the caption length is a good enough proxy and is free.
          if (caption.length > _moreThreshold)
            GestureDetector(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xxs),
                child: Text(
                  _expanded ? text.reelCaptionLess : text.reelCaptionMore,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: AppColors.reelInk,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
        ],
        if (_subjectLabel(context) != null) ...[
          const SizedBox(height: AppSpacing.md),
          _SubjectChip(
            label: _subjectLabel(context)!,
            icon: reel.verse != null
                ? Icons.menu_book_rounded
                : reel.mantra != null
                    ? Icons.self_improvement_rounded
                    : Icons.brightness_7_rounded,
            onTap: widget.onSubjectTap == null ? null : () => widget.onSubjectTap!(reel),
          ),
        ],
      ],
    );
  }

  /// Roughly two lines at this size. See the comment at the call site for why
  /// this is not measured.
  static const int _moreThreshold = 80;

  /// A reel points at at most one of a verse, a mantra or a deity — the chip
  /// shows whichever is set, in that order of specificity.
  String? _subjectLabel(BuildContext context) {
    final text = AppLocalizations.of(context);
    final reel = widget.reel;

    final verse = reel.verse;
    if (verse != null) {
      return text.reelVerseRef(
        verse.bookNumber == 1 ? text.reelBookGita : text.reelBookBhagavatam,
        verse.chapterNumber,
        verse.verseNumber,
      );
    }
    return reel.mantra?.name ?? reel.deity?.name;
  }
}

class _CreatorRow extends StatelessWidget {
  const _CreatorRow({required this.reel, required this.onTap, required this.onFollowTap});

  final Reel reel;
  final VoidCallback onTap;
  final VoidCallback onFollowTap;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final creator = reel.creator;

    return Row(
      children: [
        GestureDetector(
          onTap: onTap,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipOval(
                child: AppImage(
                  url: creator.avatarUrl,
                  cacheKey: creator.id,
                  width: AppSizes.avatarSm,
                  height: AppSizes.avatarSm,
                  borderRadius: BorderRadius.zero,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Flexible(
                child: Text(
                  creator.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: AppColors.reelInk,
                        shadows: const [
                          Shadow(color: AppColors.reelScrimStrong, blurRadius: 8),
                        ],
                      ),
                ),
              ),
              if (creator.isVerified) ...[
                const SizedBox(width: AppSpacing.xs),
                Tooltip(
                  message: text.creatorVerified,
                  child: const Icon(
                    Icons.verified_rounded,
                    size: AppSizes.iconSm,
                    color: AppColors.reelInk,
                  ),
                ),
              ],
            ],
          ),
        ),
        // Following yourself is refused by the API, so the control is not
        // drawn rather than drawn and rejected.
        if (!reel.isMine) ...[
          const SizedBox(width: AppSpacing.md),
          _FollowButton(isFollowing: reel.isFollowingCreator, onTap: onFollowTap),
        ],
      ],
    );
  }
}

/// Outline when not following, filled when following — the state is the shape,
/// not a colour, same as the action rail.
class _FollowButton extends StatelessWidget {
  const _FollowButton({required this.isFollowing, required this.onTap});

  final bool isFollowing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final label = isFollowing ? text.reelFollowing : text.reelFollow;

    return Semantics(
      button: true,
      selected: isFollowing,
      label: label,
      child: ExcludeSemantics(
        child: GestureDetector(
          onTap: onTap,
          child: AnimatedContainer(
            duration: AppDurations.fast,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: isFollowing ? AppColors.reelControl : Colors.transparent,
              border: Border.all(color: AppColors.reelInk),
              borderRadius: AppRadius.smAll,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (isFollowing) ...[
                  const Icon(Icons.check_rounded, size: AppSizes.iconSm, color: AppColors.reelInk),
                  const SizedBox(width: AppSpacing.xxs),
                ],
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: AppColors.reelInk,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// What the reel is about — a verse, a mantra or a deity — as one tappable
/// chip. This is the thing that makes a reel part of the library rather than a
/// video that happens to sit next to it.
class _SubjectChip extends StatelessWidget {
  const _SubjectChip({required this.label, required this.icon, this.onTap});

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: AppColors.reelControl,
          borderRadius: AppRadius.smAll,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: AppSizes.iconSm, color: AppColors.reelInk),
            const SizedBox(width: AppSpacing.xs),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: AppColors.reelInk,
                    ),
              ),
            ),
            if (onTap != null) ...[
              const SizedBox(width: AppSpacing.xxs),
              const Icon(
                Icons.chevron_right_rounded,
                size: AppSizes.iconSm,
                color: AppColors.reelInk,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
