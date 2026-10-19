import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import 'glass_surface.dart';
import 'nav_hero_button.dart';

/// One destination in [GlassNavBar].
class NavItem {
  const NavItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    this.iconBuilder,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;

  /// A drawn glyph in its own colours (the peacock feather) in place of the
  /// icon fonts. It keeps its colours whether or not the item is selected, so
  /// the label alone carries the state.
  final Widget Function(double size)? iconBuilder;
}

/// The button raised in the middle of the bar. It is not a destination of the
/// bar — it opens something over it — so it is never "selected".
class NavHero {
  const NavHero({
    required this.iconBuilder,
    required this.label,
    required this.semanticLabel,
    required this.onTap,
    this.after,
  });

  /// Draws the icon at the size the button chose — a builder rather than an
  /// [IconData] so it can be a drawn glyph in its own colours.
  final Widget Function(double size) iconBuilder;

  /// The short word under the button, level with the other labels.
  final String label;

  /// What a screen reader says and a long press shows; the label is not read.
  final String semanticLabel;
  final VoidCallback onTap;

  /// How many items stand to its left. The middle of the bar when null.
  final int? after;
}

/// The floating tab bar: a frosted pill of destinations, with one raised button
/// standing in the middle of it.
///
/// Detached from the edges rather than filling the bottom of the screen, so
/// content passes underneath and around it — the same shape iOS 26 draws for
/// its own chrome. `GlassSurface` renders it with a real Liquid Glass shader,
/// so Android and older iOS get it too, not just the newest phones.
///
/// [onMedia] is for when the bar is laid over a picture or a video rather than
/// over the app's own paper: the glass turns dark and the ink white, in either
/// theme, and the change is eased in and out instead of snapping.
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
    this.hero,
    this.onMedia = false,
  });

  /// The pill itself.
  static const double contentHeight = 62;

  /// How far the raised button stands above the pill.
  static const double lift = NavHeroButton.lift;

  /// The room the raised button takes in the pill's row.
  static const double _heroSlot = NavHeroButton.outer + AppSpacing.lg;

  /// What the bar occupies at the bottom of the screen, insets and the raised
  /// button included. The shell hands this to the tabs as bottom padding.
  static double heightOf(BuildContext context) =>
      lift + contentHeight + MediaQuery.viewPaddingOf(context).bottom + AppSpacing.lg;

  final List<NavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  /// Optional. Nothing is raised when it is absent.
  final NavHero? hero;

  final bool onMedia;

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewPaddingOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, inset + AppSpacing.sm),
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(end: onMedia ? 1 : 0),
        duration: AppDurations.normal,
        builder: (context, media, _) => SizedBox(
          height: lift + contentHeight,
          // The space above the pill belongs to the raised button alone; a
          // tap on the rest of it falls through to the screen underneath.
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: contentHeight,
                child: _Pill(
                  items: items,
                  selectedIndex: selectedIndex,
                  onSelected: onSelected,
                  hero: hero,
                  media: media,
                ),
              ),
              if (hero != null)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: NavHeroButton(
                      icon: hero!.iconBuilder(NavHeroButton.iconSize),
                      semanticLabel: hero!.semanticLabel,
                      onTap: hero!.onTap,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
    required this.hero,
    required this.media,
  });

  final List<NavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final NavHero? hero;

  /// 0 over the app's paper, 1 over a picture.
  final double media;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isLight = context.theme.brightness == Brightness.light;

    final selectedInk = Color.lerp(colors.primary, AppColors.reelInk, media)!;
    final idleInk = Color.lerp(
      colors.onSurfaceVariant,
      AppColors.reelInk.withValues(alpha: 0.72),
      media,
    )!;

    final gap = hero == null ? null : (hero!.after ?? items.length ~/ 2).clamp(0, items.length);

    return GlassSurface(
      radius: GlassNavBar.contentHeight / 2,
      blur: isLight ? 10 : 14,
      tint: Color.lerp(colors.surface, AppColors.black, media),
      opacity: lerpDouble(isLight ? 0.42 : 0.34, 0.5, media),
      border: BorderSide(
        color: Color.lerp(colors.outlineVariant.withValues(alpha: 0), AppColors.reelControl, media)!,
      ),
      shadows: [
        BoxShadow(
          color: isLight
              ? AppColors.orangeDeep.withValues(alpha: 0.16 * (1 - media))
              : AppColors.black.withValues(alpha: 0.5),
          blurRadius: 24,
          offset: const Offset(0, 8),
        ),
      ],
      child: SizedBox(
        height: GlassNavBar.contentHeight,
        child: Row(
          children: [
            for (var i = 0; i <= items.length; i++) ...[
              if (i == gap)
                _HeroSlot(label: hero!.label, ink: selectedInk),
              if (i < items.length)
                Expanded(
                  child: _NavButton(
                    item: items[i],
                    selected: i == selectedIndex,
                    selectedInk: selectedInk,
                    idleInk: idleInk,
                    onTap: () => onSelected(i),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The room left in the pill for the raised button, with its label at the foot
/// of it, level with the other labels.
class _HeroSlot extends StatelessWidget {
  const _HeroSlot({required this.label, required this.ink});

  final String label;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox(
        width: GlassNavBar._heroSlot,
        child: Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm + AppSpacing.xxs),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.texts.labelSmall!.copyWith(color: ink, fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.selected,
    required this.selectedInk,
    required this.idleInk,
    required this.onTap,
  });

  final NavItem item;
  final bool selected;
  final Color selectedInk;
  final Color idleInk;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colour = selected ? selectedInk : idleInk;

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
                child: item.iconBuilder != null
                    ? KeyedSubtree(
                        key: ValueKey(selected),
                        child: Opacity(
                          opacity: selected ? 1 : 0.7,
                          child: item.iconBuilder!(AppSizes.iconMd),
                        ),
                      )
                    : Icon(
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
