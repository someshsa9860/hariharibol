import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/reading_mode.dart';
import '../../models/verse.dart';
import '../../providers/reading_prefs_provider.dart';
import 'story_verse.dart';

/// The name of a story part, as the chips and the settings sheet word it.
String storyPartLabel(AppLocalizations text, StoryPart part) => switch (part) {
  StoryPart.sanskrit => text.readingHideSanskrit,
  StoryPart.transliteration => text.readingHideTransliteration,
  StoryPart.translation => text.readingPartMeaning,
  StoryPart.purport => text.mantraPurport,
};

/// The chapter's heading with a row of chips under it, in story mode: to change
/// what the story is told in without leaving the page. [empty] says the chosen
/// part has nothing in this chapter, so the page is not left blank without a word.
class StoryPartBar extends ConsumerWidget {
  const StoryPartBar({
    super.key,
    required this.header,
    required this.verses,
    this.translations = const {},
  });

  final Widget header;
  final List<Verse> verses;

  /// Renderings picked under "Compare translations", by verse id.
  final Map<String, VerseTranslation> translations;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final chosen = ref.watch(storyPartProvider);
    final empty = !verses.any(
      (v) => storyTextOf(v, chosen, translation: translations[v.id]) != null,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        header,
        const SizedBox(height: AppSpacing.md),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final part in StoryPart.values)
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: ChoiceChip(
                    label: Text(storyPartLabel(text, part)),
                    selected: chosen == part,
                    showCheckmark: false,
                    onSelected: (_) =>
                        ref.read(storyPartProvider.notifier).set(part),
                  ),
                ),
            ],
          ),
        ),
        if (empty) ...[
          const SizedBox(height: AppSpacing.md),
          Text(text.readingStoryNothing, style: context.texts.bodyMedium),
        ],
      ],
    );
  }
}
