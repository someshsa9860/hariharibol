import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../models/language.dart';
import '../../providers/languages_provider.dart';

/// The languages one slot offers, as a grid of cards. The app and reading steps
/// of the setup both use it.
class SetupLanguageGrid extends ConsumerWidget {
  const SetupLanguageGrid({
    super.key,
    required this.slot,
    required this.chosen,
    required this.onChoose,
  });

  final LanguageSlot slot;
  final String? chosen;
  final ValueChanged<String> onChoose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final options = ref.watch(languagesForSlotProvider(slot));

    return GridView.builder(
      padding: EdgeInsets.zero,
      itemCount: options.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: AppSpacing.md,
        mainAxisSpacing: AppSpacing.md,
        // A fixed height rather than an aspect ratio: the cards hold two short
        // lines whatever the screen is, and a ratio would make them tall and
        // empty on a tablet.
        mainAxisExtent: 72,
      ),
      itemBuilder: (context, index) {
        final language = options[index];
        return _LanguageCard(
          language: language,
          selected: language.code == chosen,
          onTap: () => onChoose(language.code),
        );
      },
    );
  }
}

class _LanguageCard extends StatelessWidget {
  const _LanguageCard({
    required this.language,
    required this.selected,
    required this.onTap,
  });

  final Language language;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      label: '${language.nativeName}, ${language.englishName}',
      child: ExcludeSemantics(
        child: Material(
          color: selected ? context.colors.primaryContainer : context.colors.surfaceContainerLowest,
          borderRadius: AppRadius.mdAll,
          child: InkWell(
            onTap: onTap,
            borderRadius: AppRadius.mdAll,
            child: Ink(
              decoration: BoxDecoration(
                borderRadius: AppRadius.mdAll,
                border: Border.all(
                  color: selected ? context.colors.primary : context.colors.outlineVariant,
                  width: selected ? 1.5 : 1,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // The native name leads. Someone looking for their own
                          // language is scanning for their own script, not for
                          // the English word for it.
                          Text(
                            language.nativeName,
                            style: AppTypography.section(context).copyWith(fontSize: 17),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            language.englishName,
                            style: context.texts.bodySmall,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (selected)
                      Icon(
                        Icons.check_rounded,
                        size: AppSizes.iconSm,
                        color: context.colors.primary,
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
