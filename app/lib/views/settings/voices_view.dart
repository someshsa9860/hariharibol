import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/byte_size.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/tts_model.dart';
import '../../providers/languages_provider.dart';
import '../../providers/reading_audio_provider.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/settings/voice_tile.dart';

/// The voices on this phone and the ones that can be downloaded. Spoken meaning
/// and purport use a downloaded voice when there is one for the speaking
/// language and the phone's own voice otherwise, so nothing here is required.
class VoicesView extends ConsumerWidget {
  const VoicesView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final voices = ref.watch(ttsVoicesProvider);
    final statuses = ref.watch(ttsVoiceStatusesProvider).value ?? const <String, TtsModelStatus>{};
    final languages = ref.watch(languagesProvider).value ?? const [];
    final manager = ref.watch(ttsModelManagerProvider);

    String languageNames(TtsModelSpec spec) => spec.languages
        .map((code) => languages.where((l) => l.code == code).map((l) => l.nativeName).firstOrNull ?? code)
        .join(', ');

    final used = statuses.values.whereType<TtsInstalled>().fold<int>(0, (sum, s) => sum + s.sizeBytes);

    return Scaffold(
      appBar: AppBar(title: Text(text.voicesTitle, style: context.texts.headlineSmall)),
      body: voices.when(
        loading: () => const AppLoader(),
        error: (_, _) => EmptyState(message: text.voicesEmpty),
        data: (specs) {
          if (specs.every((s) => !s.installable)) {
            return ListView(
              padding: AppSpacing.page,
              children: [
                Text(text.voicesIntro, style: context.texts.bodyMedium),
                const SizedBox(height: AppSpacing.xl),
                Text(text.voicesEmpty, style: context.texts.bodyMedium),
              ],
            );
          }
          return ListView(
            padding: AppSpacing.page,
            children: [
              Text(text.voicesIntro, style: context.texts.bodyMedium),
              const SizedBox(height: AppSpacing.sm),
              Text(text.voicesStorage(formatBytes(used)), style: context.texts.bodySmall),
              const SizedBox(height: AppSpacing.lg),
              for (final spec in specs.where((s) => s.installable))
                VoiceTile(
                  spec: spec,
                  languages: languageNames(spec),
                  status: statuses[spec.id] ?? const TtsNotInstalled(),
                  onDownload: () => manager.install(spec),
                  onCancel: () => manager.cancel(spec.id),
                  onDelete: () => manager.delete(spec.id),
                ),
            ],
          );
        },
      ),
    );
  }
}
