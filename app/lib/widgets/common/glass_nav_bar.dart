import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import 'glass_surface.dart';

/// One destination in [GlassNavBar].
class NavItem {
  const NavItem({required this.icon, required this.selectedIcon, required this.label});

  final IconData icon;
  final IconData selectedIcon;
  final String label;
}

/// The single action that sits in its own circle beside the bar.
class NavAction {
  const NavAction({required this.icon, required this.label, required this.onTap});

  final IconData icon;

  /// Not drawn — it is the accessible name and the tooltip.
  final String label;
  final VoidCallback onTap;
}

/// The floating tab bar: a frosted pill of destinations, with one action in a
/// circle of its own beside it.
///
/// Detached from the edges rather than filling the bottom of the screen, so
/// content passes underneath and around it — the same shape iOS 26 draws for
/// its own chrome. `GlassSurface` renders it with a real Liquid Glass shader,
/// so Android and older iOS get it too, not just the newest phones.
///
/// Built rather than wrapping Material's `NavigationBar` because the height has
/// to be a number this file knows: the shell measures the body's bottom padding
/// from it, and `NavigationBar` sizes itself from its own internals — constrain
/// it and the labels clip, leave it free and nothing lines up with it.
class GlassNavBar extends StatelessWidget {
  const GlassNavBar({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
    this.action,
  });

  /// The pill itself, and the circle beside it.
  static const double contentHeight = 62;

  static const double _gap = AppSpacing.sm;

  /// What the bar occupies at the bottom of the screen, insets included. The
  /// shell hands this to the tabs as bottom padding.
  static double heightOf(BuildContext context) =>
      contentHeight + MediaQuery.viewPaddingOf(context).bottom + AppSpacing.lg;

  final List<NavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  /// Optional. Nothing is drawn beside the pill when it is absent.
  final NavAction? action;

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewPaddingOf(context).bottom;
    final isLight = context.theme.brightness == Brightness.light;

    final shadows = [
      BoxShadow(
        color: isLight
            ? AppColors.orangeDeep.withValues(alpha: 0.16)
            : AppColors.black.withValues(alpha: 0.5),
        blurRadius: 24,
        offset: const Offset(0, 8),
      ),
    ];
    final edge = BorderSide(color: context.colors.outlineVariant);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        0,
        AppSpacing.lg,
        inset + AppSpacing.sm,
      ),
      child: Row(
        children: [
          Expanded(
            child: GlassSurface(
              radius: contentHeight / 2,
              blur: isLight ? 10 : 14,
              border: edge,
              shadows: shadows,
              child: SizedBox(
                height: contentHeight,
                child: Row(
                  children: [
                    for (var i = 0; i < items.length; i++)
                      Expanded(
                        child: _NavButton(
                          item: items[i],
                          selected: i == selectedIndex,
                          onTap: () => onSelected(i),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          if (action != null) ...[
            const SizedBox(width: _gap),
            GlassSurface(
              radius: contentHeight / 2,
              blur: isLight ? 10 : 14,
              border: edge,
              shadows: shadows,
              child: Tooltip(
                message: action!.label,
                child: InkWell(
                  onTap: action!.onTap,
                  customBorder: const CircleBorder(),
                  child: SizedBox(
                    width: contentHeight,
                    height: contentHeight,
                    child: Semantics(
                      button: true,
                      label: action!.label,
                      child: Icon(
                        action!.icon,
                        size: AppSizes.iconMd,
                        color: context.colors.primary,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({required this.item, required this.selected, required this.onTap});

  final NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colour = selected ? context.colors.primary : context.colors.onSurfaceVariant;

    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: ExcludeSemantics(
        child: InkWell(
          onTap: onTap,
          customBorder: const StadiumBorder(),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // The icon carries the state change on its own — a moving pill
              // behind it would fight the glass the whole bar is made of.
              AnimatedSwitcher(
                duration: AppDurations.fast,
                child: Icon(
                  selected ? item.selectedIcon : item.icon,
                  key: ValueKey(selected),
                  size: AppSizes.iconMd,
                  color: colour,
                ),
              ),
              const SizedBox(height: AppSpacing.xxs),
              AnimatedDefaultTextStyle(
                duration: AppDurations.fast,
                style: context.texts.labelSmall!.copyWith(
                  color: colour,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
                child: Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
