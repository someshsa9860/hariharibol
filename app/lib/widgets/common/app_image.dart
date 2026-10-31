import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// Every remote image in the app.
///
/// Media URLs are S3 presigned links with an expiry, so they change between
/// responses. The cache is keyed on the URL, which means a re-signed link is a
/// cache miss — [cacheKey] takes a stable id instead, so a cover is fetched
/// once rather than on every refresh.
///
/// Given a width and a height, it decodes the picture at the size it will be
/// drawn rather than at the size it was uploaded. A photo is stored as pixels —
/// a 2000 px profile picture is 16 MB decoded — and an avatar or a grid tile
/// only ever paints a few hundred of them; holding the rest makes a list of
/// them heavy to scroll. A side left out or infinite (a picture that fills its
/// parent, such as a reel) is taken as the screen's, which is as large as it
/// can be drawn — a 4000 px upload is not held whole for a phone's screen.
class AppImage extends StatelessWidget {
  const AppImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.cacheKey,
    this.borderRadius = AppRadius.mdAll,
    this.fit = BoxFit.cover,
  });

  final String? url;
  final double? width;
  final double? height;
  final String? cacheKey;
  final BorderRadius borderRadius;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final placeholder = _Placeholder(width: width, height: height, radius: borderRadius);
    final source = url;
    if (source == null || source.isEmpty) return placeholder;

    return ClipRRect(
      borderRadius: borderRadius,
      child: CachedNetworkImage(
        imageUrl: source,
        cacheKey: cacheKey,
        width: width,
        height: height,
        memCacheWidth: _decodeWidth(MediaQuery.sizeOf(context), MediaQuery.devicePixelRatioOf(context)),
        fit: fit,
        fadeInDuration: AppDurations.fast,
        placeholder: (context, _) => placeholder,
        errorWidget: (context, _, _) => placeholder,
      ),
    );
  }

  /// The width, in pixels, to decode at — or null to decode the whole picture.
  /// A side not given, or infinite, is the [screen]'s.
  ///
  /// Only the width is given, so the height follows the picture's own shape
  /// and nothing is stretched. It is the *longer* side of the box, not the
  /// width of it, because `cover` scales a picture until it fills both sides:
  /// a picture shaped differently from its box (a landscape one in a portrait
  /// tile) needs more width than the box has to stay sharp. A picture is never
  /// enlarged to reach this, so a small original is simply used as it is.
  int? _decodeWidth(Size screen, double pixelRatio) {
    final w = _sideOr(width, screen.width);
    final h = _sideOr(height, screen.height);
    final longest = w > h ? w : h;
    if (longest <= 0) return null;
    return (longest * pixelRatio).ceil();
  }

  static double _sideOr(double? side, double screen) => side != null && side.isFinite ? side : screen;
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({this.width, this.height, required this.radius});

  final double? width;
  final double? height;
  final BorderRadius radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerHighest,
        borderRadius: radius,
      ),
    );
  }
}
