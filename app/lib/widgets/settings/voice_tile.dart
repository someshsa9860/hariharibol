import 'package:flutter/material.dart';

import '../../core/format/byte_size.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/tts_model.dart';

/// One downloadable voice: its name, the languages it speaks, where it stands,
/// and the one action that makes sense right now. Every state has words as well
/// as an icon.
class VoiceTile extends StatelessWidget {
  const VoiceTile({
    super.key,
    required this.spec,
    required this.languages,
    required this.status,
    required this.onDownload,
    required this.onCancel,
    required this.onDelete,
  });

  final TtsModelSpec spec;
  final String languages;
  final TtsModelStatus status;
  final VoidCallback onDownload;
  final VoidCallback onCancel;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    final (String caption, Widget action) = switch (status) {
      TtsInstalled(:final sizeBytes) => (
          text.voiceInstalled(formatBytes(sizeBytes)),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded),
            tooltip: text.voiceDelete,
            onPressed: () => _confirmDelete(context),
          ),
        ),
      TtsDownloading(:final fraction) => (
          text.voiceDownloading((fraction * 100).round()),
          IconButton(icon: const Icon(Icons.close_rounded), tooltip: text.voiceCancel, onPressed: onCancel),
        ),
      TtsVerifying() => (text.voiceVerifying, const SizedBox.shrink()),
      TtsExtracting() => (text.voiceExtracting, const SizedBox.shrink()),
      TtsFailed() => (
          text.voiceFailed,
          IconButton(icon: const Icon(Icons.refresh_rounded), tooltip: text.voiceRetry, onPressed: onDownload),
        ),
      TtsNotInstalled() => (
          text.voiceNotInstalled(formatBytes(spec.sizeBytes)),
          IconButton(icon: const Icon(Icons.download_rounded), tooltip: text.voiceDownload, onPressed: onDownload),
        ),
    };

    final progress = switch (status) {
      TtsDownloading(:final fraction) => fraction > 0 ? fraction : null,
      TtsVerifying() || TtsExtracting() => null,
      _ => -1.0,
    };

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(spec.name, style: context.texts.titleMedium),
                      const SizedBox(height: AppSpacing.xs),
                      Text(text.voiceLanguages(languages), style: context.texts.bodySmall),
                      const SizedBox(height: AppSpacing.xs),
                      Text(caption, style: context.texts.bodySmall),
                    ],
                  ),
                ),
                action,
              ],
            ),
            if (progress != -1.0) ...[
              const SizedBox(height: AppSpacing.sm),
              LinearProgressIndicator(value: progress),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final text = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(text.voiceDeleteTitle),
        content: Text(text.voiceDeleteBody),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(text.voiceCancel)),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: Text(text.voiceDelete)),
        ],
      ),
    );
    if (confirmed == true) onDelete();
  }
}
