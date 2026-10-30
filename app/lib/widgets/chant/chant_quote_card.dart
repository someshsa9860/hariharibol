import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_config.dart';
import '../../core/constants/chant_quote_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/quote.dart';
import '../../providers/chant_battery_saver_provider.dart';
import '../../providers/quote_provider.dart';
import '../../services/chant_quote_rotation.dart';
import '../common/animations.dart';

/// A quote in the middle of the chanting page, where the deity and the mala
/// are in the other view. A tap anywhere on it counts a chant, exactly as a
/// tap on the ring does ([onTap]); the quote changes after every 12 of them.
///
/// [chants] is the count the rotation follows and [seed] fixes the order for
/// the sitting (`ChantQuoteRotation`). With no quotes (offline with no saved
/// copy, or none published) the card says so and still counts.
class ChantQuoteCard extends ConsumerStatefulWidget {
  const ChantQuoteCard({super.key, required this.chants, required this.seed, required this.onTap});

  final int chants;
  final int seed;
  final VoidCallback onTap;

  /// The least the card is tall, so it takes about the room the ring takes and
  /// the page does not jump when a longer quote comes.
  static const double minHeight = 280;

  @override
  ConsumerState<ChantQuoteCard> createState() => _ChantQuoteCardState();
}

class _ChantQuoteCardState extends ConsumerState<ChantQuoteCard> {
  List<int> _order = const [];
  int _orderedFor = -1;
  int _orderedSeed = 0;

  /// The shuffle for this many quotes, kept until the list or the seed changes.
  List<int> _orderOf(int length) {
    if (length != _orderedFor || widget.seed != _orderedSeed) {
      _order = ChantQuoteRotation.order(length, widget.seed);
      _orderedFor = length;
      _orderedSeed = widget.seed;
    }
    return _order;
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final quotes = ref.watch(chantQuotesProvider);
    final batterySaver = ref.watch(chantBatterySaverProvider);
    final list = quotes.value ?? const <Quote>[];

    final Widget content;
    if (list.isNotEmpty) {
      final index = ChantQuoteRotation.indexFor(order: _orderOf(list.length), chants: widget.chants)!;
      final quote = list[index];
      content = _QuoteBody(key: ValueKey(quote.id), quote: quote);
    } else if (quotes.isLoading) {
      content = const Center(key: ValueKey('loading'), child: CircularProgressIndicator());
    } else {
      content = Center(
        key: const ValueKey('none'),
        child: Text(
          text.chantQuoteNone,
          textAlign: TextAlign.center,
          style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TapScale(
          onTap: widget.onTap,
          scale: 0.985,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: context.colors.surfaceContainerLow,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: context.colors.outlineVariant),
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: ChantQuoteCard.minHeight),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: AnimatedSwitcher(
                  duration: batterySaver ? Duration.zero : AppDurations.slow,
                  child: content,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          text.chantQuoteTapHint,
          textAlign: TextAlign.center,
          style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _QuoteBody extends StatelessWidget {
  const _QuoteBody({super.key, required this.quote});

  final Quote quote;

  @override
  Widget build(BuildContext context) {
    final muted = context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    final author = AppConfig.showQuoteAuthor ? quote.author?.trim() ?? '' : '';
    final reference = quote.reference?.trim() ?? '';
    final source = quote.sourceName?.trim() ?? '';

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.format_quote_rounded, size: AppSizes.iconLg, color: context.colors.primary),
        const SizedBox(height: AppSpacing.sm),
        Text(
          quote.text,
          textAlign: TextAlign.center,
          maxLines: ChantQuoteConfig.maxLines,
          overflow: TextOverflow.ellipsis,
          style: context.texts.titleMedium?.copyWith(height: 1.45),
        ),
        if (author.isNotEmpty || reference.isNotEmpty || source.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          if (author.isNotEmpty) Text(author, textAlign: TextAlign.center, style: muted),
          if (reference.isNotEmpty) Text(reference, textAlign: TextAlign.center, style: muted),
          if (source.isNotEmpty) Text(source, textAlign: TextAlign.center, style: muted),
        ],
      ],
    );
  }
}
