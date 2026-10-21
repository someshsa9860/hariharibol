import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import 'glass_nav_bar.dart';

/// The navigation on windows too wide for the bottom bar: a column down the
/// left edge with the same destinations, and Sakha's button at the top where
/// the bar raises it.
///
/// [extended] puts each label beside its icon (tablets held wide, desktop
/// windows, TVs); otherwise the label sits under the icon in a narrow rail.
/// Every destination is a real focus target with a visible ring, so a TV
/// remote's arrow keys and a keyboard's Tab walk it and Select / Enter opens
/// one; a mouse gets a hover tint.
///
/// It takes the bar's own [NavItem] and [NavHero], so the two are described
/// once in the shell and cannot drift apart.
class SideNav extends StatelessWidget {
  const SideNav({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
    required this.extended,
    this.hero,
    this.title,
  });

  final List<NavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final bool extended;
  final NavHero? hero;

  /// The name of the app, shown at the top of an extended column.
  final String? title;

  static const double railWidth = 92;
  static const double extendedWidth = 264;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return FocusTraversalGroup(
      policy: OrderedTraversalPolicy(),
      child: Container(
        width: extended ? extendedWidth : railWidth,
        decoration: BoxDecoration(
          color: scheme.surfaceContainerLow,
          border: Border(right: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.6))),
        ),
        child: SafeArea(
          right: false,
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: extended ? AppSpacing.lg : AppSpacing.sm,
              vertical: AppSpacing.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (extended && title != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.md, 0, AppSpacing.md, AppSpacing.xl),
                    child: Text(
                      title!,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: scheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                if (hero != null) ...[
                  _HeroButton(hero: hero!, extended: extended),
                  const SizedBox(height: AppSpacing.xl),
                ],
                for (var i = 0; i < items.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                    child: _Destination(
                      item: items[i],
                      selected: i == selectedIndex,
                      extended: extended,
                      onTap: () => onSelected(i),
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

class _Destination extends StatelessWidget {
  const _Destination({
    required this.item,
    required this.selected,
    required this.extended,
    required this.onTap,
  });

  final NavItem item;
  final bool selected;
  final bool extended;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final ink = selected ? scheme.primary : scheme.onSurfaceVariant;

    final icon = item.iconBuilder != null
        ? item.iconBuilder!(AppSizes.iconMd)
        : Icon(selected ? item.selectedIcon : item.icon, size: AppSizes.iconMd, color: ink);

    final label = Text(
      item.label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: (extended ? textTheme.titleSmall : textTheme.labelSmall)?.copyWith(
        color: ink,
        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
      ),
    );

    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      excludeSemantics: true,
      child: _FocusRing(
        selected: selected,
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: extended ? AppSpacing.md : AppSpacing.xs,
            vertical: extended ? AppSpacing.md : AppSpacing.sm,
          ),
          child: extended
              ? Row(children: [icon, const SizedBox(width: AppSpacing.md), Expanded(child: label)])
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [icon, const SizedBox(height: AppSpacing.xs), label],
                ),
        ),
      ),
    );
  }
}

class _HeroButton extends StatelessWidget {
  const _HeroButton({required this.hero, required this.extended});

  final NavHero hero;
  final bool extended;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    // The disc is neutral so the icon keeps its own colours; the rim is the
    // brand colour, as on the raised bar button.
    final disc = Container(
      width: 48,
      height: 48,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: scheme.brightness == Brightness.light ? Colors.white : Colors.black,
        border: Border.all(color: scheme.primary, width: 2),
        boxShadow: [BoxShadow(color: scheme.primary.withValues(alpha: 0.25), blurRadius: 14)],
      ),
      child: hero.iconBuilder(28),
    );

    return Semantics(
      button: true,
      label: hero.semanticLabel,
      excludeSemantics: true,
      child: _FocusRing(
        selected: false,
        onTap: hero.onTap,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: extended ? AppSpacing.md : AppSpacing.xs,
            vertical: AppSpacing.sm,
          ),
          child: extended
              ? Row(
                  children: [
                    disc,
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: Text(hero.label, style: textTheme.titleSmall)),
                  ],
                )
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [disc, const SizedBox(height: AppSpacing.xs), Text(hero.label, style: textTheme.labelSmall)],
                ),
        ),
      ),
    );
  }
}

/// A tappable, focusable, hoverable rounded tile. Focus draws a ring (what a
/// TV viewer follows with the arrow keys); hover a tint; selection a fill.
class _FocusRing extends StatefulWidget {
  const _FocusRing({required this.selected, required this.onTap, required this.child});

  final bool selected;
  final VoidCallback onTap;
  final Widget child;

  @override
  State<_FocusRing> createState() => _FocusRingState();
}

class _FocusRingState extends State<_FocusRing> {
  bool _focused = false;
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fill = widget.selected
        ? scheme.primary.withValues(alpha: 0.12)
        : _hovered
        ? scheme.onSurface.withValues(alpha: 0.06)
        : Colors.transparent;

    return AnimatedContainer(
      duration: AppDurations.fast,
      decoration: BoxDecoration(
        color: fill,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: _focused ? scheme.primary : Colors.transparent, width: 2),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: AppRadius.mdAll,
          onTap: widget.onTap,
          onHover: (value) => setState(() => _hovered = value),
          onFocusChange: (value) => setState(() => _focused = value),
          child: widget.child,
        ),
      ),
    );
  }
}
