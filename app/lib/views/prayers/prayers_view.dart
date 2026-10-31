import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/prayer.dart';
import '../../providers/prayer_provider.dart';
import '../../widgets/common/animations.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/prayers/prayer_category_bar.dart';
import '../../widgets/prayers/prayer_tile.dart';

/// Every published prayer. The whole list is a few dozen titles, so a category
/// narrows it here on the phone, with no request and no flicker.
class PrayersView extends ConsumerStatefulWidget {
  const PrayersView({super.key});

  @override
  ConsumerState<PrayersView> createState() => _PrayersViewState();
}

class _PrayersViewState extends ConsumerState<PrayersView> {
  /// The chosen category's id; null is every category.
  String? _category;

  /// Only the tiles in view when the screen opens ease in; the rest are drawn
  /// as they scroll up and should not each wait for an entrance.
  static const int _eased = 6;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final list = ref.watch(prayerListProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.prayersTitle, style: context.texts.headlineSmall)),
      body: list.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
          onRetry: () async => ref.refresh(prayerListProvider.future),
        ),
        data: (data) {
          // A category that has since gone (unpublished, or the list refreshed)
          // falls back to every category rather than an empty list.
          final selected = data.categories.any((c) => c.id == _category) ? _category : null;
          final items = [
            for (final prayer in data.items)
              if (selected == null || prayer.category == selected) prayer,
          ];
          // Chips for one category say nothing; they are for choosing between.
          final showBar = data.categories.length > 1;
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(prayerListProvider.future),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: AppSpacing.page,
              children: [
                if (showBar) ...[
                  PrayerCategoryBar(
                    categories: data.categories,
                    selected: selected,
                    onSelected: (id) => setState(() => _category = id),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
                if (items.isEmpty)
                  EmptyState(message: text.prayersEmpty)
                else
                  for (var i = 0; i < items.length; i++) _row(data, items[i], i),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _row(PrayerList data, Prayer prayer, int index) {
    String? categoryName;
    for (final category in data.categories) {
      if (category.id == prayer.category) categoryName = category.name;
    }
    final tile = Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: PrayerTile(prayer: prayer, categoryName: categoryName),
    );
    if (index >= _eased) return tile;
    return FadeSlideIn(key: ValueKey(prayer.id), index: index, child: tile);
  }
}
