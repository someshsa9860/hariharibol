import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// A person's picture, or their first letter on the primary tint when they have
/// none.
class PersonAvatar extends StatelessWidget {
  const PersonAvatar({super.key, required this.name, this.url, this.size = AppSizes.avatarSm});

  final String name;
  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) {
    final letters = name.trim().characters;
    final initial = letters.isEmpty ? '?' : letters.first.toUpperCase();

    return CircleAvatar(
      radius: size / 2,
      backgroundColor: context.colors.primaryContainer,
      foregroundImage: url == null ? null : CachedNetworkImageProvider(url!),
      child: Text(initial, style: context.texts.titleSmall?.copyWith(color: context.colors.onPrimaryContainer)),
    );
  }
}
