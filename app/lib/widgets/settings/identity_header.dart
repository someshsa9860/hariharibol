import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../models/app_user.dart';
import '../common/app_image.dart';

/// Who is signed in: avatar, name, email. Sits above the settings groups
/// rather than buried as a row inside one of them.
class IdentityHeader extends StatelessWidget {
  const IdentityHeader({super.key, required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final url = user.avatarUrl;

    return Row(
      children: [
        Container(
          width: AppSizes.avatarLg,
          height: AppSizes.avatarLg,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: context.colors.primaryContainer,
            border: Border.all(color: context.colors.outlineVariant),
          ),
          clipBehavior: Clip.antiAlias,
          child: url != null && url.isNotEmpty
              ? AppImage(
                  url: url,
                  cacheKey: 'avatar-${user.id}',
                  width: AppSizes.avatarLg,
                  height: AppSizes.avatarLg,
                  borderRadius: const BorderRadius.all(
                    Radius.circular(AppRadius.pill),
                  ),
                )
              : Center(
                  child: Text(
                    user.initials,
                    style: AppTypography.numeral(
                      context,
                      size: 28,
                    ).copyWith(color: context.colors.onPrimaryContainer),
                  ),
                ),
        ),
        const SizedBox(width: AppSpacing.lg),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                user.displayName,
                style: context.texts.headlineSmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                user.email,
                style: context.texts.bodySmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
