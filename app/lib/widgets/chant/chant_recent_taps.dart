import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chant_log.dart';
import '../common/eyebrow.dart';
import 'chant_tap_row.dart';

/// The last few chants, newest first, under the ring — each with the time it
/// was counted and the seconds it took, so the pace is visible as it happens.
class ChantRecentTaps extends StatelessWidget {
  const ChantRecentTaps({super.key, required this.taps});

  /// Oldest first, as the recorder keeps them; this shows the tail reversed.
  final List<ChantTapLog> taps;

  static const int _shown = 4;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final recent = taps.reversed.take(_shown).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow(text.chantRecentTitle),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.xs),
            child: recent.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                    child: Center(
                      child: Text(
                        text.chantRecentEmpty,
                        style: context.texts.bodyMedium?.copyWith(
                          color: context.colors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  )
                : Column(
                    children: [
                      for (var i = 0; i < recent.length; i++) ...[
                        if (i > 0) const Divider(),
                        ChantTapRow(tap: recent[i]),
                      ],
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}
