import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/mantra_category.dart';
import '../../models/sadhana.dart';
import '../../providers/mantra_provider.dart';
import '../../providers/sadhana_provider.dart';
import '../../services/sadhana_service.dart';
import '../../widgets/common/animations.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/eyebrow.dart';
import '../../widgets/common/motif.dart';
import '../../widgets/common/section_header.dart';
import '../../widgets/dashboard/log_rounds_sheet.dart';
import '../../widgets/dashboard/mantra_list_tile.dart';

/// Chanting and today's rounds.
///
/// One request fills the screen, the same shape as the dashboard: a hero for
/// today's count, what has already been chanted, and the mantras to chant
/// next. There is no tradition picker — the platform serves one sampradaya for
/// now, so a screen for choosing between traditions would be a control with
/// nothing behind it.
class SadhanaTab extends ConsumerWidget {
  const SadhanaTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = ref.watch(sadhanaTodayProvider);
    final text = AppLocalizations.of(context);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: today.when(
          loading: () => const AppLoader(),
          error: (error, _) => AppErrorView(
            failure: error is ApiFailure
                ? error
                : ApiFailure(
                    kind: FailureKind.unknown,
                    message: text.errorGeneric,
                  ),
            onRetry: () => ref.read(sadhanaTodayProvider.notifier).refresh(),
          ),
          data: (data) => RefreshIndicator(
            onRefresh: () => ref.read(sadhanaTodayProvider.notifier).refresh(),
            child: _SadhanaContent(today: data),
          ),
        ),
      ),
    );
  }
}

class _SadhanaContent extends ConsumerWidget {
  const _SadhanaContent({required this.today});

  final SadhanaToday today;

  /// Opens the counter already carrying the standing preferred mantra, the
  /// same way tapping "chant this" from a mantra's own page does. With
  /// nothing preferred, this is exactly the old generic "chant now".
  Future<void> _chantNow(BuildContext context, WidgetRef ref) async {
    final slug = today.profile?.preferredMantraSlug;
    final navigator = AppNavigator.instance;
    if (slug == null) {
      navigator.push(AppRoutes.chant);
      return;
    }

    try {
      final mantra = await navigator.loading.wrap(
        () => ref.read(mantraDetailProvider(slug).future),
      );
      navigator.push(AppRoutes.chant, extra: mantra);
    } on ApiFailure catch (failure) {
      navigator.showFailure(failure);
    }
  }

  Future<void> _logRounds(BuildContext context, WidgetRef ref) async {
    final rounds = await showLogRoundsSheet(context);
    if (rounds == null) return;

    final navigator = AppNavigator.instance;
    try {
      await navigator.loading.wrap(
        () => SadhanaService.instance.logManualRounds(rounds: rounds),
      );
      await ref.read(sadhanaTodayProvider.notifier).refresh();
    } on ApiFailure catch (failure) {
      navigator.showFailure(failure);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sections = <Widget>[
      _RoundsHero(
        day: today.day,
        streak: today.streak,
        onChant: () => _chantNow(context, ref),
        onLogRounds: () => _logRounds(context, ref),
      ),
      const _MantraBrowser(),
    ];

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: AppSpacing.page.copyWith(
        bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xxl,
      ),
      itemCount: sections.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.xl),
      itemBuilder: (context, index) =>
          FadeSlideIn(index: index, child: sections[index]),
    );
  }
}

class _RoundsHero extends StatelessWidget {
  const _RoundsHero({
    required this.day,
    required this.streak,
    required this.onChant,
    required this.onLogRounds,
  });

  final SadhanaDay day;
  final int streak;
  final VoidCallback onChant;
  final VoidCallback onLogRounds;

  /// The same band the home tab's sadhana card carries, so the two read as one
  /// family rather than two takes on the same card.
  static const double _panelWidth = 92;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final met = day.roundTargetMet;
    final colour = met
        ? context.semanticColors.success
        : context.colors.primary;

    final isLight = context.theme.brightness == Brightness.light;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Padding(
                    padding: AppSpacing.card,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Eyebrow(text.sadhanaRoundsEyebrow),
                        const SizedBox(height: AppSpacing.md),
                        Semantics(
                          label: text.sadhanaRoundsProgress(
                            day.roundsCompleted,
                            day.roundTarget,
                          ),
                          excludeSemantics: true,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                '${day.roundsCompleted}',
                                style: AppTypography.numeral(context, size: 40),
                              ),
                              const SizedBox(width: AppSpacing.xs),
                              Text(
                                '/ ${day.roundTarget}',
                                style: context.texts.titleMedium?.copyWith(
                                  color: context.colors.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (streak > 0) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.local_fire_department_rounded,
                                size: AppSizes.iconSm,
                                color: context.colors.primary,
                              ),
                              const SizedBox(width: AppSpacing.xs),
                              Text(
                                text.sadhanaStreak(streak),
                                style: context.texts.bodySmall,
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                SizedBox(
                  width: _panelWidth,
                  child: MotifPanel(
                    motif: Motif.lotus,
                    from: isLight
                        ? AppColors.panelFrom
                        : AppColors.panelFromDark,
                    to: isLight ? AppColors.panelTo : AppColors.panelToDark,
                    lineColor: context.colors.primary,
                    lineOpacity: isLight ? 0.40 : 0.55,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            // No top inset: the block above already ends on one, and the bar
            // is meant to sit just under the panel band, not float below it.
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              0,
              AppSpacing.lg,
              AppSpacing.lg,
            ),
            child: Column(
              children: [
                ClipRRect(
                  borderRadius: AppRadius.smAll,
                  child: LinearProgressIndicator(
                    value: day.roundProgress,
                    minHeight: AppSpacing.xs,
                    color: colour,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: onChant,
                        icon: const Icon(Icons.radio_button_unchecked_rounded),
                        label: Text(text.sadhanaChantNow),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onLogRounds,
                        child: Text(text.sadhanaLogRounds),
                      ),
                    ),
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

/// Category chips over a plain list. There is no tradition to browse by yet,
/// so the category is the only real axis the content has.
class _MantraBrowser extends ConsumerStatefulWidget {
  const _MantraBrowser();

  @override
  ConsumerState<_MantraBrowser> createState() => _MantraBrowserState();
}

class _MantraBrowserState extends ConsumerState<_MantraBrowser> {
  String? _category;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final categories =
        ref.watch(mantraCategoriesProvider).value ?? const <MantraCategory>[];
    final mantras = ref.watch(mantraListProvider(_category));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: text.homeMantras),
        if (categories.isNotEmpty) ...[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            child: Row(
              children: [
                _CategoryChip(
                  key: const ValueKey('_all'),
                  label: text.mantraAllCategories,
                  selected: _category == null,
                  onTap: () => setState(() => _category = null),
                ),
                for (final category in categories) ...[
                  const SizedBox(width: AppSpacing.sm),
                  _CategoryChip(
                    key: ValueKey(category.slug),
                    label: category.label,
                    selected: _category == category.slug,
                    onTap: () => setState(() => _category = category.slug),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        mantras.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
            child: AppLoader(),
          ),
          error: (_, _) => Text(
            text.errorGeneric,
            style: context.texts.bodyMedium?.copyWith(
              color: context.colors.onSurfaceVariant,
            ),
          ),
          data: (list) => list.isEmpty
              ? Text(
                  text.mantraNoneInCategory,
                  style: context.texts.bodyMedium?.copyWith(
                    color: context.colors.onSurfaceVariant,
                  ),
                )
              : Column(
                  children: [
                    for (final mantra in list) ...[
                      MantraListTile(
                        key: ValueKey(mantra.slug),
                        name: mantra.name,
                        text: mantra.text,
                        category: mantra.category,
                        deity: mantra.deity,
                        hasAudio: mantra.hasAudio,
                        onTap: () => AppNavigator.instance.push(
                          AppRoutes.mantraPath(mantra.slug),
                        ),
                      ),
                      if (mantra != list.last)
                        const SizedBox(height: AppSpacing.sm),
                    ],
                  ],
                ),
        ),
      ],
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
    );
  }
}
