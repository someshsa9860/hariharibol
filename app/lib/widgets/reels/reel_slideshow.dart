import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/reel.dart';
import '../common/app_image.dart';

/// An IMAGE reel: one or more photos, swiped horizontally.
///
/// Horizontal, while the feed itself is vertical. That is the arrangement
/// people already know from every other short-form app, and the two gestures
/// do not fight because a `PageView` claims the axis it is given and passes
/// the other one up.
///
/// A single-image reel still comes through here rather than being special-
/// cased: one page with no dots looks exactly like a plain photo, and the
/// alternative is two code paths that have to stay in step.
class ReelSlideshow extends StatefulWidget {
  const ReelSlideshow({
    super.key,
    required this.reel,
    required this.isActive,
    this.onTap,
  });

  final Reel reel;

  /// Returning to a reel restarts its slideshow, the same way returning to a
  /// video restarts the clip.
  final bool isActive;

  final VoidCallback? onTap;

  @override
  State<ReelSlideshow> createState() => _ReelSlideshowState();
}

class _ReelSlideshowState extends State<ReelSlideshow> {
  late final PageController _controller = PageController();
  int _index = 0;

  @override
  void didUpdateWidget(covariant ReelSlideshow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.isActive && oldWidget.isActive && _index != 0) {
      _controller.jumpToPage(0);
      setState(() => _index = 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final images = widget.reel.media;

    // An IMAGE reel with no rows behind it — the thumbnail is all there is.
    if (images.isEmpty) {
      return AppImage(
        url: widget.reel.thumbnailUrl,
        cacheKey: widget.reel.id,
        borderRadius: BorderRadius.zero,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
      );
    }

    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: images.length,
            onPageChanged: (index) => setState(() => _index = index),
            itemBuilder: (context, index) => AppImage(
              url: images[index].imageUrl,
              // Keyed on the row id, not the signed URL, so a re-signed link
              // is not a cache miss — see AppImage.
              cacheKey: images[index].id,
              borderRadius: BorderRadius.zero,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
            ),
          ),
          if (images.length > 1)
            Positioned(
              top: AppSpacing.lg,
              left: 0,
              right: 0,
              child: Semantics(
                label: text.reelSlideOf(_index + 1, images.length),
                child: _Dots(count: images.length, index: _index),
              ),
            ),
        ],
      ),
    );
  }
}

/// Which photo of how many. Dots rather than a counter — at this size a
/// number is harder to read at a glance than a row of marks, and the dots also
/// say how many are left without being counted.
class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.index});

  final int count;
  final int index;

  static const double _size = 6;
  static const double _activeWidth = 18;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < count; i++)
            AnimatedContainer(
              duration: AppDurations.fast,
              margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xxs),
              height: _size,
              width: i == index ? _activeWidth : _size,
              decoration: BoxDecoration(
                color: i == index ? AppColors.reelInk : AppColors.reelControl,
                borderRadius: BorderRadius.circular(_size / 2),
              ),
            ),
        ],
      ),
    );
  }
}
