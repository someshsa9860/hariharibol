import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';

/// One verse of a prayer: its number, the verse in the script chosen (and the
/// original above it, muted, when asked for), and a full-width row that opens
/// its meaning in a tinted block. A verse with no meaning has no row.
///
/// Whether the meaning is open is the screen's to hold, so "expand all" and
/// the remembered default reach every verse at once.
class PrayerVerseBlock extends StatelessWidget {
  const PrayerVerseBlock({
    super.key,
    required this.number,
    required this.verse,
    required this.scale,
    required this.open,
    required this.onToggle,
    this.roman = false,
    this.original,
    this.meaning,
  });

  /// 1-based place in the prayer.
  final int number;

  /// The verse in the chosen script.
  final String verse;

  /// Roman letters take the face made for reading them; every other script
  /// takes the verse face.
  final bool roman;

  /// The verse as it was written, to show above [verse]; null when it is not
  /// wanted or [verse] already is it.
  final String? original;

  final String? meaning;

  /// The reading font size's scale.
  final double scale;

  final bool open;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final colors = context.colors;
    final style = roman
        ? AppTypography.transliteration(context, scale: scale).copyWith(color: colors.onSurface)
        : AppTypography.verse(context, scale: scale);
    final about = meaning?.trim() ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          label: text.prayersVerseNumber(number),
          excludeSemantics: true,
          child: Container(
            constraints: const BoxConstraints(minWidth: AppSizes.avatarSm),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
            decoration: BoxDecoration(color: colors.secondaryContainer, borderRadius: AppRadius.smAll),
            child: Text(
              '$number',
              textAlign: TextAlign.center,
              style: context.texts.labelMedium?.copyWith(color: colors.onSecondaryContainer),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (original != null) ...[
          Text(
            original!,
            style: AppTypography.verse(context, scale: scale * _originalScale)
                .copyWith(color: colors.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        Text(verse, style: style),
        if (about.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          _MeaningRow(open: open, onToggle: onToggle),
          AnimatedSize(
            duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : AppDurations.normal,
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: open
                ? Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.xs),
                    child: _MeaningBody(text: about, scale: scale),
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
      ],
    );
  }

  /// The original above a script is a guide, not the reading: a step smaller
  /// than the verse under it.
  static const double _originalScale = 0.85;
}

/// "Meaning" and a turning chevron, across the whole width and never shorter
/// than a finger needs.
class _MeaningRow extends StatelessWidget {
  const _MeaningRow({required this.open, required this.onToggle});

  final bool open;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return Semantics(
      button: true,
      expanded: open,
      hint: open ? text.prayersHideMeaning : text.prayersShowMeaning,
      child: InkWell(
        onTap: onToggle,
        borderRadius: AppRadius.smAll,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinInteractiveDimension),
          child: Row(
            children: [
              Text(
                text.prayersMeaning,
                style: context.texts.labelLarge?.copyWith(color: context.colors.primary),
              ),
              const SizedBox(width: AppSpacing.xs),
              AnimatedRotation(
                turns: open ? 0.5 : 0,
                duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : AppDurations.fast,
                child: Icon(Icons.expand_more_rounded, size: AppSizes.iconMd, color: context.colors.primary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The meaning in a rounded tinted block, in the reading font size.
class _MeaningBody extends StatelessWidget {
  const _MeaningBody({required this.text, required this.scale});

  final String text;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final base = context.texts.bodyLarge;
    return Container(
      width: double.infinity,
      padding: AppSpacing.card,
      decoration: BoxDecoration(color: context.colors.surfaceContainer, borderRadius: AppRadius.mdAll),
      child: Text(
        text,
        style: base?.copyWith(fontSize: (base.fontSize ?? 16) * scale, height: 1.6),
      ),
    );
  }
}
