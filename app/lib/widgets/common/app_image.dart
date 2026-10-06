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
        fit: fit,
        fadeInDuration: AppDurations.fast,
        placeholder: (context, _) => placeholder,
        errorWidget: (context, _, _) => placeholder,
      ),
    );
  }
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
