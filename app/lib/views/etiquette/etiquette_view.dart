import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../providers/etiquette_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/etiquette/etiquette_category_bar.dart';
import '../../widgets/etiquette/etiquette_tile.dart';
import '../../widgets/etiquette/etiquette_today_card.dart';

/// Devotee etiquette: today's item, then every published item. The whole list is
/// a few dozen titles, so a category narrows it here on the phone, with no
/// request and no flicker.
class EtiquetteView extends ConsumerStatefulWidget {
  const EtiquetteView({super.key});

  @override
  ConsumerState<EtiquetteView> createState() => _EtiquetteViewState();
}

class _EtiquetteViewState extends ConsumerState<EtiquetteView> {
  /// The chosen category's id; null is every category.
  String? _category;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final list = ref.watch(etiquetteListProvider);
    final today = ref.watch(etiquetteTodayProvider).asData?.value.item;

    return Scaffold(
      appBar: AppBar(title: Text(text.etiquetteTitle, style: context.texts.headlineSmall)),
      body: list.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
          onRetry: () async => ref.refresh(etiquetteListProvider.future),
        ),
        data: (data) {
          // A category that has since gone (unpublished, or the list refreshed)
          // falls back to every category rather than an empty list.
          final selected = data.categories.any((c) => c.id == _category) ? _category : null;
          final items = [
            for (final item in data.items)
              if (selected == null || item.category == selected) item,
          ];
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(etiquetteListProvider.future),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: AppSpacing.page,
              children: [
                if (today != null && selected == null) ...[
                  EtiquetteTodayCard(item: today),
                  const SizedBox(height: AppSpacing.xl),
                ],
                EtiquetteCategoryBar(
                  categories: data.categories,
                  selected: selected,
                  onSelected: (id) => setState(() => _category = id),
                ),
                const SizedBox(height: AppSpacing.lg),
                if (items.isEmpty)
                  EmptyState(message: text.etiquetteEmpty)
                else
                  for (final item in items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: EtiquetteTile(item: item),
                    ),
              ],
            ),
          );
        },
      ),
    );
  }
}
