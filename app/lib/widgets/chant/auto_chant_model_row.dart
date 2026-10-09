import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/auto_chant_model_provider.dart';
import '../../services/mantra_accurate_model.dart';

/// The optional download that makes auto-count read Sanskrit properly: offer it,
/// show it arriving, say it is on, let it be taken off. Shows nothing at all when
/// there is nothing to offer — this app does not ship controls that cannot do anything.
class AutoChantModelRow extends ConsumerWidget {
  const AutoChantModelRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final model = ref.watch(autoChantModelProvider);
    if (model.phase == AutoChantModelPhase.hidden) return const SizedBox.shrink();

    final text = AppLocalizations.of(context);
    final notifier = ref.read(autoChantModelProvider.notifier);
    final (status, action) = switch (model.phase) {
      AutoChantModelPhase.available => (
          text.chantModelOffer(MantraAccurateModel.downloadMegabytes),
          TextButton(onPressed: notifier.download, child: Text(text.chantModelDownload)),
        ),
      AutoChantModelPhase.downloading => (
          text.chantModelDownloading((model.progress * 100).round()),
          TextButton(onPressed: notifier.cancel, child: Text(text.chantModelCancel)),
        ),
      AutoChantModelPhase.installed => (
          text.chantModelInstalled,
          TextButton(onPressed: notifier.remove, child: Text(text.chantModelRemove)),
        ),
      _ => (
          text.chantModelFailed,
          TextButton(onPressed: notifier.download, child: Text(text.chantModelRetry)),
        ),
    };

    return Column(
      children: [
        const Divider(),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          child: Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: context.colors.onSurfaceVariant),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(text.chantModelTitle, style: context.texts.bodyLarge),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      status,
                      style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                    ),
                    if (model.phase == AutoChantModelPhase.downloading) ...[
                      const SizedBox(height: AppSpacing.sm),
                      LinearProgressIndicator(value: model.progress),
                    ],
                  ],
                ),
              ),
              action,
            ],
          ),
        ),
      ],
    );
  }
}
