import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/verse_provider.dart';

/// Curated cross-links out of one verse — see `VerseLink` on the backend.
/// Picking one closes the sheet and opens that verse's own chapter.
Future<void> showRelatedVersesSheet(BuildContext context, {required String verseId}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    builder: (context) => _RelatedVersesSheet(verseId: verseId),
  );
}

class _RelatedVersesSheet extends ConsumerWidget {
  const _RelatedVersesSheet({required this.verseId});

  final String verseId;

  String _relationLabel(AppLocalizations text, String relation) => switch (relation) {
        'EXPANDS_ON' => text.relationExpandsOn,
        'QUOTED_IN' => text.relationQuotedIn,
        'CONTRASTS_WITH' => text.relationContrastsWith,
        _ => text.relationSameConcept,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final related = ref.watch(verseRelatedProvider(verseId));

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
              Text(text.verseRelatedTitle, style: context.texts.titleLarge),
              const SizedBox(height: AppSpacing.md),
              Flexible(
                child: related.when(
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
                          child: Text(text.verseRelatedEmpty),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          itemCount: list.length,
                          separatorBuilder: (context, index) => const Divider(),
                          itemBuilder: (context, index) {
                            final item = list[index];
                            final target = item.verse;
                            final meaning = target.translation?.meaning?.trim();
                            final slug = target.book?.slug;
                            final chapterNumber = target.chapterNumber;

                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(target.reference),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(_relationLabel(text, item.relation)),
                                  if (meaning != null && meaning.isNotEmpty)
                                    Text(meaning, maxLines: 2, overflow: TextOverflow.ellipsis),
                                ],
                              ),
                              onTap: slug == null || chapterNumber == null
                                  ? null
                                  : () {
                                      Navigator.of(context).pop();
                                      AppNavigator.instance.push(
                                        AppRoutes.chapterPath(
                                          slug,
                                          chapterNumber,
                                          canto: target.cantoNumber,
                                        ),
                                      );
                                    },
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
