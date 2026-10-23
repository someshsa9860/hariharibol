import 'package:flutter/material.dart';

import '../../core/format/chant_format.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/chant_pace.dart';

/// How long one chant takes this reader, with a button each way to change it.
///
/// Auto count counts by this and, with it off, a hand tap is held to half of it.
/// The line under the title says what it comes to — seconds a chant and the time
/// of a whole round — so the effect of a step can be read at once. A button is
/// disabled at the end of the range ([ChantPace.canStep]) rather than doing
/// nothing.
class ChantPaceRow extends StatelessWidget {
  const ChantPaceRow({
    super.key,
    required this.pace,
    required this.standard,
    required this.beadsPerRound,
    required this.onChange,
  });

  final Duration pace;

  /// The mantra's standard time, which the range and the step are worked from.
  final Duration standard;
  final int beadsPerRound;

  /// Called with the pace one step longer (`longer: true`) or shorter.
  final void Function({required bool longer}) onChange;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final canShorten = ChantPace.canStep(pace, standard, longer: false);
    final canLengthen = ChantPace.canStep(pace, standard, longer: true);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Icon(Icons.timer_outlined, color: context.colors.onSurfaceVariant),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text.chantPaceTitle, style: context.texts.bodyLarge),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  text.chantPaceSummary(
                    formatMillisAsSeconds(pace.inMilliseconds),
                    formatClock(pace * beadsPerRound),
                  ),
                  style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.remove_rounded),
            tooltip: text.chantPaceShorter,
            onPressed: canShorten ? () => onChange(longer: false) : null,
          ),
          IconButton(
            icon: const Icon(Icons.add_rounded),
            tooltip: text.chantPaceLonger,
            onPressed: canLengthen ? () => onChange(longer: true) : null,
          ),
        ],
      ),
    );
  }
}
