import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/app_user.dart';
import '../common/app_image.dart';

/// The top of the dashboard: the date, the greeting and the person's avatar.
class HomeHeader extends StatelessWidget {
  const HomeHeader({super.key, required this.date, this.user});

  /// The user's own local date as the server worked it out, not the device
  /// clock — a traveller should not skip a day.
  final String date;
  final AppUser? user;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final name = user?.displayName;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_formatted(text, date), style: context.texts.bodySmall),
              const SizedBox(height: AppSpacing.xs),
              Text(
                name == null ? text.homeGreeting : text.homeGreetingNamed(name),
                style: context.texts.headlineMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        if (user != null) ...[
          const SizedBox(width: AppSpacing.md),
          _Avatar(user: user!),
        ],
      ],
    );
  }

  /// "Saturday · 27 April". Falls back to nothing rather than to a raw
  /// `2026-04-27`, which would read as a bug on the first line of the screen.
  String _formatted(AppLocalizations text, String date) {
    final parsed = DateTime.tryParse(date);
    if (parsed == null) return '';
    try {
      return text.homeDateLine(parsed);
    } catch (_) {
      return '';
    }
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final url = user.avatarUrl;

    return Semantics(
      button: true,
      label: user.displayName,
      child: GestureDetector(
        onTap: () => AppNavigator.instance.push(AppRoutes.settings),
        child: Container(
          width: AppSizes.avatarMd,
          height: AppSizes.avatarMd,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: context.colors.primaryContainer,
            // Most avatars come back on a white ground, which is invisible
            // against paper — the ring is what makes it read as a circle.
            border: Border.all(color: context.colors.outlineVariant),
          ),
          clipBehavior: Clip.antiAlias,
          child: url != null && url.isNotEmpty
              ? AppImage(
                  url: url,
                  cacheKey: 'avatar-${user.id}',
                  width: AppSizes.avatarMd,
                  height: AppSizes.avatarMd,
                  borderRadius: const BorderRadius.all(
                    Radius.circular(AppRadius.pill),
                  ),
                )
              : Center(
                  child: Text(
                    user.initials,
                    style: AppTypography.numeral(
                      context,
                      size: 18,
                    ).copyWith(color: context.colors.onPrimaryContainer),
                  ),
                ),
        ),
      ),
    );
  }
}
