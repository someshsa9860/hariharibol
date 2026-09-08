import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../models/verse.dart';
import '../common/eyebrow.dart';
import '../common/motif.dart';

/// The verse at the top of the dashboard — the one thing on the screen that is
/// meant to be read rather than scanned.
///
/// The order is fixed and deliberate: script, then sound, then sense. Someone
/// who reads Devanagari never has to look past the first line; someone who does
/// not can follow the transliteration into the translation. The translator is
/// named beside their own words, because an acharya's rendering is theirs and
/// must never be laid out as if it were ours.
///
/// Used for both the shared sloka of the day and the personal one — same shape,
/// different label and motif, so the two never look like different features.
class VerseHeroCard extends StatelessWidget {
  const VerseHeroCard({
    super.key,
    required this.label,
    required this.verse,
    this.motif = Motif.lotus,
    this.reason,
    this.onTap,
  });

  /// The eyebrow — "Verse of the day", "For you today".
  final String label;
  final Verse verse;
  final Motif motif;

  /// Why this verse was chosen for this person, when it was chosen for them.
  final String? reason;
  final VoidCallback? onTap;

  static const double _panelWidth = 108;

  @override
  Widget build(BuildContext context) {
    final sanskrit = verse.sanskrit?.trim();
    final transliteration = verse.transliteration?.trim();
    final meaning = verse.translation?.meaning?.trim();
    final translator = verse.translation?.translator?.name;
    final isLight = context.theme.brightness == Brightness.light;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // The panel runs to the card's own edge, so the label and the
            // script are the only things inset here.
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.lg,
                        AppSpacing.lg,
                        AppSpacing.md,
                        AppSpacing.lg,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Eyebrow(label, color: context.colors.primary),
                          const SizedBox(height: AppSpacing.md),
                          if (sanskrit != null && sanskrit.isNotEmpty)
                            Text(sanskrit, style: AppTypography.verse(context, size: 19))
                          else
                            Text(verse.reference, style: AppTypography.verse(context, size: 19)),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(
                    width: _panelWidth,
                    child: MotifPanel(
                      motif: motif,
                      from: isLight ? AppColors.panelFrom : AppColors.panelFromDark,
                      to: isLight ? AppColors.panelTo : AppColors.panelToDark,
                      lineColor: context.colors.primary,
                      lineOpacity: isLight ? 0.45 : 0.60,
                    ),
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (transliteration != null && transliteration.isNotEmpty) ...[
                    Text(transliteration, style: AppTypography.transliteration(context)),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  if (reason != null && reason!.trim().isNotEmpty) ...[
                    Text(
                      reason!,
                      style: context.texts.bodySmall?.copyWith(color: context.colors.primary),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  if (meaning != null && meaning.isNotEmpty) ...[
                    Text(
                      '“$meaning”',
                      style: context.texts.bodyLarge,
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                  // The translator gets a line of their own. Sharing the
                  // footer with the citation truncated the name, and an
                  // acharya's name is not something to show as "Swam…".
                  if (translator != null && translator.isNotEmpty) ...[
                    Text(
                      '\u2014 $translator',
                      style: context.texts.bodySmall,
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          verse.citation,
                          style: context.texts.bodySmall,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      // Only when there is somewhere to go. An arrow on a card
                      // that does nothing is a promise the screen cannot keep.
                      if (onTap != null) ...[
                        const SizedBox(width: AppSpacing.sm),
                        Icon(
                          Icons.arrow_forward_rounded,
                          size: AppSizes.iconSm,
                          color: context.colors.primary,
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
