import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/heard_words.dart';
import '../common/eyebrow.dart';
import 'heard_match_meter.dart';
import 'voice_bars.dart';

/// "Heard live" on the counter: the words the phone is hearing as they come,
/// what the last stretch of voice came to, and a few before it — so a person
/// can see for themselves why a chant was or was not counted.
///
/// Shows nothing for a null [heard] (no listening helper is on) and eases open
/// and shut when one is switched on and off. The words are the recogniser's,
/// written in whatever script it writes; they are never changed or hidden here.
class ChantHeardCard extends StatelessWidget {
  const ChantHeardCard({super.key, required this.heard});

  final HeardWords? heard;

  @override
  Widget build(BuildContext context) {
    final source = heard;
    return AnimatedSize(
      duration: AppDurations.normal,
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: source == null
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xl),
              child: _HeardCard(heard: source),
            ),
    );
  }
}

class _HeardCard extends StatelessWidget {
  const _HeardCard({required this.heard});

  final HeardWords heard;

  /// Finished stretches of voice listed under the main line.
  static const int _earlierShown = 3;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: ListenableBuilder(
          listenable: heard,
          builder: (context, _) => _content(context),
        ),
      ),
    );
  }

  Widget _content(BuildContext context) {
    final text = AppLocalizations.of(context);
    final colors = context.colors;

    final running = heard.live.isNotEmpty;
    final hearing = running || heard.voiceActive;
    final latest = heard.latest;

    // The main line is what is being said, or, between chants, what was last.
    final line = running ? heard.live : (latest?.text ?? '');
    final match = running ? heard.liveMatch : latest?.match;
    final needed = running ? heard.liveNeeded : latest?.needed;
    final counted = running ? heard.liveCounted : (latest?.counted ?? 0);
    final earlier = (running ? heard.recent : heard.recent.skip(1)).take(_earlierShown).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow(text.chantHeardTitle),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            VoiceBars(active: hearing),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                hearing ? text.chantHeardHearing : text.chantHeardWaiting,
                style: context.texts.bodySmall?.copyWith(color: colors.onSurfaceVariant),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        if (line.isEmpty)
          Text(
            text.chantHeardPlaceholder,
            style: context.texts.bodyMedium?.copyWith(color: colors.onSurfaceVariant),
          )
        else ...[
          if (!running) ...[
            Text(
              text.chantHeardLast,
              style: context.texts.bodySmall?.copyWith(color: colors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
          // Devanagari and the other Indic scripts take the verse style, not the
          // serif: it carries the extra leading their marks need.
          Text(
            line,
            style: AppTypography.verse(context, size: 20).copyWith(
              color: running ? colors.onSurface : colors.onSurfaceVariant,
            ),
          ),
        ],
        if (line.isNotEmpty && match != null) ...[
          const SizedBox(height: AppSpacing.sm),
          HeardMatchMeter(match: match, needed: needed),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.xs,
            children: [
              Text(
                needed == null
                    ? text.chantHeardMatchShort(_percent(match))
                    : text.chantHeardMatch(_percent(match), _percent(needed)),
                style: context.texts.bodySmall?.copyWith(color: colors.onSurfaceVariant),
              ),
              // Said once the stretch is over, or as soon as it has counted:
              // "not counted" while someone is still mid-chant would be premature.
              if (counted > 0 || !running) _Outcome(counted: counted),
            ],
          ),
        ],
        if (earlier.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          const Divider(),
          const SizedBox(height: AppSpacing.xs),
          Text(
            text.chantHeardEarlier,
            style: context.texts.bodySmall?.copyWith(color: colors.onSurfaceVariant),
          ),
          for (final utterance in earlier) _EarlierRow(utterance: utterance),
        ],
      ],
    );
  }

  static int _percent(double ratio) => (ratio * 100).round().clamp(0, 100);
}

/// Counted, or not — an icon and words together, never colour alone.
class _Outcome extends StatelessWidget {
  const _Outcome({required this.counted});

  final int counted;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final did = counted > 0;

    return Semantics(
      liveRegion: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            did ? Icons.check_circle_rounded : Icons.remove_circle_outline_rounded,
            size: AppSizes.iconSm,
            color: did ? context.colors.primary : context.colors.onSurfaceVariant,
          ),
          const SizedBox(width: AppSpacing.xs),
          Text(
            did ? text.chantHeardCounted(counted) : text.chantHeardNotCounted,
            style: context.texts.labelLarge?.copyWith(
              color: did ? context.colors.onSurface : context.colors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _EarlierRow extends StatelessWidget {
  const _EarlierRow({required this.utterance});

  final HeardUtterance utterance;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final muted = context.colors.onSurfaceVariant;
    final compared = utterance.match != null;
    final did = utterance.counted > 0;

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Row(
        children: [
          Icon(
            !compared
                ? Icons.chat_bubble_outline_rounded
                : did
                    ? Icons.check_circle_rounded
                    : Icons.remove_circle_outline_rounded,
            size: AppSizes.iconSm,
            color: did ? context.colors.primary : muted,
            semanticLabel: !compared
                ? null
                : did
                    ? text.chantHeardCounted(utterance.counted)
                    : text.chantHeardNotCounted,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              utterance.text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.texts.bodyMedium,
            ),
          ),
          if (compared) ...[
            const SizedBox(width: AppSpacing.sm),
            Text(
              text.chantHeardMatchShort(_HeardCard._percent(utterance.match!)),
              style: context.texts.bodySmall?.copyWith(color: muted),
            ),
          ],
        ],
      ),
    );
  }
}
