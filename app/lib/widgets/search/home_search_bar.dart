import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// The search bar at the top of Home, under the greeting. It looks like a
/// field but is a button: a tap opens the full search screen, which is also
/// what the Read tab's search icon opens, so both behave the same.
class HomeSearchBar extends StatelessWidget {
  const HomeSearchBar({super.key});

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final colors = context.colors;

    return Semantics(
      button: true,
      label: text.searchHint,
      child: Material(
        color: colors.surfaceContainerHighest,
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
        child: InkWell(
          borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
          onTap: () => AppNavigator.instance.push(AppRoutes.search),
          child: SizedBox(
            height: 46,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Row(
                children: [
                  Icon(Icons.search_rounded, color: colors.onSurfaceVariant),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      text.searchHint,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.texts.bodyLarge?.copyWith(color: colors.onSurfaceVariant),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
