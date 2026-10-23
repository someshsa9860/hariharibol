import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../providers/etiquette_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/eyebrow.dart';
import '../../widgets/etiquette/etiquette_category_label.dart';
import '../../widgets/etiquette/etiquette_source_card.dart';

/// A blank line in the text starts a new paragraph.
final RegExp _paragraphBreak = RegExp(r'\n\s*\n');

/// One piece of etiquette in full: what to do, why, and where it comes from.
/// Opened from the list, from Home's card, and by the 7:15 push.
class EtiquetteItemView extends ConsumerWidget {
  const EtiquetteItemView({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final provider = etiquetteItemProvider(id);

    return Scaffold(
      appBar: AppBar(title: Text(text.etiquetteTitle, style: context.texts.headlineSmall)),
      body: ref.watch(provider).when(
            loading: () => const AppLoader(),
            error: (error, _) => AppErrorView(
              failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
              onRetry: () async => ref.refresh(provider.future),
            ),
            data: (item) {
              final paragraphs = [
                for (final part in item.body.split(_paragraphBreak))
                  if (part.trim().isNotEmpty) part.trim(),
              ];
              return ListView(
                padding: AppSpacing.page,
                children: [
                  Eyebrow(etiquetteCategoryLabel(text, item.category)),
                  const SizedBox(height: AppSpacing.sm),
                  Text(item.title, style: context.texts.headlineMedium),
                  const SizedBox(height: AppSpacing.lg),
                  Text(item.summary, style: context.texts.titleMedium),
                  if (paragraphs.isNotEmpty) const SizedBox(height: AppSpacing.xl),
                  for (final paragraph in paragraphs)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                      child: Text(paragraph, style: context.texts.bodyLarge),
                    ),
                  const SizedBox(height: AppSpacing.md),
                  EtiquetteSourceCard(item: item),
                ],
              );
            },
          ),
    );
  }
}
