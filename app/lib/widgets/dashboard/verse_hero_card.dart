import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/format/script.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/verse.dart';
import '../common/animations.dart';
import '../common/eyebrow.dart';
import '../common/motif.dart';
import '../../views/share/share_studio_view.dart';
import '../share/share_target.dart';

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
///
/// [onPhoto] is the Verse of the Day's dress: the verse centred over the blurred
/// lotus photograph the daily notification is drawn over, faded right back so the
/// card still reads as a light card with a hint of the picture behind it. The
/// words, their colours, their order and what is left out when a verse is thin are
/// the same; only the ground and the layout around them change.
class VerseHeroCard extends StatelessWidget {
  const VerseHeroCard({
    super.key,
    required this.label,
    required this.verse,
    this.motif = Motif.lotus,
    this.reason,
    this.onTap,
    this.onPhoto = false,
  });

  /// The eyebrow — "Verse of the day", "For you today".
  final String label;
  final Verse verse;
  final Motif motif;

  /// Why this verse was chosen for this person, when it was chosen for them.
  final String? reason;
  final VoidCallback? onTap;

  /// Draw the card over the blurred photograph instead of the plain card with
  /// its motif panel. [motif] is not used then — the photograph is the picture.
  final bool onPhoto;

  static const double _panelWidth = 108;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final sanskrit = verse.sanskrit?.trim();
    // Not drawn when it is in the verse's own script: a Hindi or Marathi reader's would repeat it.
    final transliteration = verse.transliteration?.trim();
    final showTransliteration = transliteration != null &&
        transliteration.isNotEmpty &&
        !(sanskrit != null && sameScript(transliteration, sanskrit));
    final meaning = verse.translation?.meaning?.trim();
    final translator = verse.translation?.translator?.creditName;
    final isLight = context.theme.brightness == Brightness.light;

    if (onPhoto) {
      return TapScale(
        onTap: onTap,
        child: _PhotoCard(
          label: label,
          verse: verse,
          sanskrit: sanskrit,
          transliteration: showTransliteration ? transliteration : null,
          meaning: meaning,
          translator: translator,
          reason: reason,
          arrow: onTap != null,
        ),
      );
    }

    return TapScale(
      onTap: onTap,
      child: Card(
        clipBehavior: Clip.antiAlias,
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
                  if (showTransliteration) ...[
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
                      text.labelQuotedMeaning(meaning),
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
                      text.labelTranslatorCredit(translator),
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
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(Icons.ios_share_rounded, size: AppSizes.iconSm),
                        tooltip: text.shareTitle,
                        onPressed: () => ShareStudio.open(context, ShareTarget.verse(verse)),
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

/// The card over its photograph: the blurred lotus faded into the card's own
/// ground, then the verse centred in the theme's ordinary ink. The picture is
/// only a tint — nothing is laid over it to make the words readable, because the
/// words never leave the theme's text colours.
class _PhotoCard extends StatelessWidget {
  const _PhotoCard({
    required this.label,
    required this.verse,
    required this.sanskrit,
    required this.transliteration,
    required this.meaning,
    required this.translator,
    required this.reason,
    required this.arrow,
  });

  final String label;
  final Verse verse;
  final String? sanskrit;
  final String? transliteration;
  final String? meaning;
  final String? translator;
  final String? reason;
  final bool arrow;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final hasSanskrit = sanskrit != null && sanskrit!.isNotEmpty;
    final accent = context.colors.primary;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          const Positioned.fill(child: _Backdrop()),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Eyebrow(label, color: accent, align: TextAlign.center),
                const SizedBox(height: AppSpacing.sm),
                _Ornament(color: accent),
                const SizedBox(height: AppSpacing.md),
                Text(
                  hasSanskrit ? sanskrit! : verse.reference,
                  textAlign: TextAlign.center,
                  style: AppTypography.verse(context, size: 20),
                ),
                const SizedBox(height: AppSpacing.md),
                if (transliteration != null) ...[
                  Text(
                    transliteration!,
                    textAlign: TextAlign.center,
                    style: AppTypography.transliteration(context),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                if (reason != null && reason!.trim().isNotEmpty) ...[
                  Text(
                    reason!,
                    textAlign: TextAlign.center,
                    style: context.texts.bodySmall?.copyWith(color: accent),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                if (meaning != null && meaning!.isNotEmpty) ...[
                  Text(
                    text.labelQuotedMeaning(meaning!),
                    textAlign: TextAlign.center,
                    style: context.texts.bodyLarge,
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                if (translator != null && translator!.isNotEmpty) ...[
                  Text(
                    text.labelTranslatorCredit(translator!),
                    textAlign: TextAlign.center,
                    style: context.texts.bodySmall,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        verse.citation,
                        style: context.texts.bodySmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.ios_share_rounded, size: AppSizes.iconSm),
                      tooltip: text.shareTitle,
                      onPressed: () => ShareStudio.open(context, ShareTarget.verse(verse)),
                    ),
                    // Only when there is somewhere to go, as on the plain card.
                    if (arrow) ...[
                      const SizedBox(width: AppSpacing.sm),
                      Icon(
                        Icons.arrow_forward_rounded,
                        size: AppSizes.iconSm,
                        color: accent,
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The blurred photograph, drawn faintly over the card's own colour. How faint is
/// the whole design: strong enough to be recognised as the notification's lotus,
/// weak enough that the ink on top of it never has to change. A dark card can take
/// a little more of it than a light one, where the same strength reads as a stain.
/// Decoration only — the words on top carry the meaning.
class _Backdrop extends StatelessWidget {
  const _Backdrop();

  static const double _opacityLight = 0.18;
  static const double _opacityDark = 0.26;

  @override
  Widget build(BuildContext context) {
    final isLight = context.theme.brightness == Brightness.light;
    return ExcludeSemantics(
      child: Image.asset(
        AppAssets.verseBackdrop,
        fit: BoxFit.cover,
        opacity: AlwaysStoppedAnimation(isLight ? _opacityLight : _opacityDark),
      ),
    );
  }
}

/// A short rule with a diamond in the middle — the notification card's
/// ornament, under the label.
class _Ornament extends StatelessWidget {
  const _Ornament({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    final rule = SizedBox(width: 36, height: 1, child: ColoredBox(color: color));
    return ExcludeSemantics(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          rule,
          const SizedBox(width: AppSpacing.sm),
          Transform.rotate(
            angle: 0.7853981633974483, // a quarter turn halved: a square on its corner
            child: SizedBox(width: 6, height: 6, child: ColoredBox(color: color)),
          ),
          const SizedBox(width: AppSpacing.sm),
          rule,
        ],
      ),
    );
  }
}
