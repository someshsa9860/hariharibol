import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/language.dart';
import '../../models/prayer.dart';
import '../../providers/languages_provider.dart';

/// The scripts a prayer can be read in, one chip each: the original, Roman
/// letters, then every other script by the name its own readers call the
/// language. One row that scrolls sideways, so it stays one line tall however
/// many scripts there are.
class PrayerScriptBar extends ConsumerWidget {
  const PrayerScriptBar({super.key, required this.prayer, required this.selected, required this.onSelected});

  final Prayer prayer;

  /// The code of the script on show.
  final String selected;
  final ValueChanged<String> onSelected;

  /// The code of the Roman writing; every prayer offers it as a stored script.
  static const String _romanCode = 'en';

  /// How tall the bar is: a chip is as tall as a finger needs, and grows with
  /// the reader's text size.
  static double extentFor(BuildContext context) =>
      MediaQuery.textScalerOf(context).scale(kMinInteractiveDimension) + AppSpacing.sm;

  String _label(AppLocalizations text, Map<String, String> names, PrayerScript script) {
    if (script.isOriginal) return text.prayersScriptOriginal;
    if (script.code == _romanCode) return text.prayersScriptRoman;
    // A language the catalogue does not list (or has not loaded) is named by
    // its code rather than left blank.
    return names[script.code] ?? script.code.toUpperCase();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final names = <String, String>{
      for (final language in ref.watch(languagesProvider).value ?? const <Language>[])
        language.code: language.nativeName,
    };
    return ColoredBox(
      color: context.colors.surface,
      child: Align(
        alignment: Alignment.centerLeft,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: AppSpacing.screenH,
          child: Row(
            children: [
              for (final script in prayer.scripts)
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: ChoiceChip(
                    label: Text(_label(text, names, script)),
                    selected: selected == script.code,
                    onSelected: (_) => onSelected(script.code),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Keeps [PrayerScriptBar] at the top of the screen while the verses scroll
/// under it.
class PrayerScriptBarPin extends SliverPersistentHeaderDelegate {
  const PrayerScriptBarPin({required this.child, required this.extent});

  final Widget child;
  final double extent;

  @override
  double get minExtent => extent;

  @override
  double get maxExtent => extent;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => child;

  @override
  bool shouldRebuild(PrayerScriptBarPin oldDelegate) =>
      oldDelegate.child != child || oldDelegate.extent != extent;
}
