import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/verse.dart';
import '../../providers/verse_provider.dart';

/// Every acharya's rendering of one verse, for comparing them side by side.
/// Returns the one picked; the reading screen shows it in place of the
/// default until the reader picks another or leaves the chapter.
Future<VerseTranslation?> showTranslationPickerSheet(
  BuildContext context, {
  required String verseId,
}) {
  return showModalBottomSheet<VerseTranslation>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    builder: (context) => _TranslationPickerSheet(verseId: verseId),
  );
}

class _TranslationPickerSheet extends ConsumerWidget {
  const _TranslationPickerSheet({required this.verseId});

  final String verseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final translations = ref.watch(verseTranslationsProvider(verseId));

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.7),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(text.verseCompareTranslations, style: context.texts.titleLarge),
              const SizedBox(height: AppSpacing.md),
              Flexible(
                child: translations.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(AppSpacing.xl),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (_, _) => Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Text(text.errorGeneric),
                  ),
                  data: (list) => list.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(AppSpacing.xl),
                          child: Text(text.verseTranslationsEmpty),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          itemCount: list.length,
                          separatorBuilder: (context, index) => const Divider(),
                          itemBuilder: (context, index) {
                            final rendering = list[index];
                            final meaning = rendering.meaning?.trim();
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(rendering.translator?.name ?? rendering.languageCode),
                              subtitle: meaning == null || meaning.isEmpty
                                  ? null
                                  : Text(meaning, maxLines: 2, overflow: TextOverflow.ellipsis),
                              onTap: () => Navigator.of(context).pop(rendering),
                            );
                          },
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
