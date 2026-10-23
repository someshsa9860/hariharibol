import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/script.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/mantra.dart';
import '../../providers/mantra_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/eyebrow.dart';
import '../../widgets/dashboard/mantra_category_label.dart';
import '../../widgets/mantra/mantra_picture_header.dart';
import '../../widgets/mantra/own_mantra_actions.dart';
import '../../widgets/share/share_target.dart';
import '../share/share_studio_view.dart';

/// One mantra: the script to chant, its meaning, and the way into the counter
/// already carrying it — so "chant this" never means re-finding it there.
class MantraDetailView extends ConsumerWidget {
  const MantraDetailView({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mantra = ref.watch(mantraDetailProvider(slug));
    final text = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        actions: [
          // A mantra only its readers hold has no public page to share.
          if (mantra.value != null && !mantra.value!.isPrivate)
            IconButton(
              icon: const Icon(Icons.ios_share_rounded),
              tooltip: text.shareTitle,
              onPressed: () => ShareStudio.open(context, ShareTarget.mantra(mantra.value!)),
            ),
        ],
      ),
      body: mantra.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure
              ? error
              : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
          onRetry: () async => ref.invalidate(mantraDetailProvider(slug)),
        ),
        data: (data) => _MantraDetail(mantra: data),
      ),
    );
  }
}

class _MantraDetail extends StatelessWidget {
  const _MantraDetail({required this.mantra});

  final Mantra mantra;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final transliteration = _transliterationToShow(mantra.transliteration?.trim(), mantra.text);
    final meaning = mantra.meaning?.trim();
    final purport = mantra.purport?.trim();
    final standard = mantra.standardRounds > 0
        ? text.mantraStandardRounds(mantra.standardRounds)
        : mantra.standardCount > 0
            ? text.mantraStandardCount(mantra.standardCount)
            : null;

    return ListView(
      padding: AppSpacing.page.copyWith(
        bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xxl,
      ),
      children: [
        if (mantra.isPrivate) ...[
          MantraPictureHeader(mantra: mantra),
          const SizedBox(height: AppSpacing.lg),
        ],
        if (mantra.category != null)
          Eyebrow(
            mantraCategoryLabel(text, mantra.category!),
            color: context.colors.primary,
          ),
        const SizedBox(height: AppSpacing.md),
        Text(mantra.name, style: context.texts.headlineMedium),
        const SizedBox(height: AppSpacing.lg),
        Text(mantra.text, style: AppTypography.verse(context, size: 20)),
        if (transliteration != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(transliteration, style: AppTypography.transliteration(context)),
        ],
        if (mantra.hasAudio) ...[
          const SizedBox(height: AppSpacing.md),
          // Indicates a recitation exists; there is nowhere yet to play it
          // from — that is a player, not a detail screen, and belongs with
          // the rest of the narration work in the reader.
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.graphic_eq_rounded,
                size: AppSizes.iconSm,
                color: context.colors.onSurfaceVariant,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(text.mantraHasAudio, style: context.texts.bodySmall),
            ],
          ),
        ],
        if (standard != null) ...[
          const SizedBox(height: AppSpacing.lg),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              color: context.colors.primaryContainer,
              borderRadius: AppRadius.smAll,
            ),
            child: Text(
              standard,
              style: context.texts.labelLarge?.copyWith(color: context.colors.onPrimaryContainer),
            ),
          ),
        ],
        if (meaning != null && meaning.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xl),
          Text(text.labelQuotedMeaning(meaning), style: context.texts.bodyLarge),
        ],
        if (purport != null && purport.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xl),
          Eyebrow(text.mantraPurport),
          const SizedBox(height: AppSpacing.sm),
          Text(purport, style: context.texts.bodyMedium),
        ],
        if (mantra.deity != null || mantra.guru != null) ...[
          const SizedBox(height: AppSpacing.xl),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (mantra.deity != null) Chip(label: Text(mantra.deity!.name)),
              if (mantra.guru != null) Chip(label: Text(mantra.guru!.name)),
            ],
          ),
        ],
        if (mantra.myRounds > 0) ...[
          const SizedBox(height: AppSpacing.xl),
          Text(
            text.mantraMyRounds(mantra.myRounds),
            style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
          ),
        ],
        const SizedBox(height: AppSpacing.xxl),
        SizedBox(
          height: AppSizes.buttonHeight,
          child: FilledButton.icon(
            onPressed: () => AppNavigator.instance.push(AppRoutes.chant, extra: mantra),
            icon: const Icon(Icons.radio_button_unchecked_rounded),
            label: Text(text.mantraChantThis),
          ),
        ),
        if (mantra.isPrivate) ...[
          const SizedBox(height: AppSpacing.lg),
          OwnMantraActions(mantra: mantra),
        ],
      ],
    );
  }
}

/// The Roman line under a mantra's text is for the Devanagari reader. The text now
/// arrives in the reading language's own script (Kannada letters for a Kannada
/// reader), and Roman under that, or a repeat of the text, would say it twice.
String? _transliterationToShow(String? transliteration, String text) {
  if (transliteration == null || transliteration.isEmpty) return null;
  if (!isDevanagari(text) || sameScript(transliteration, text)) return null;
  return transliteration;
}
