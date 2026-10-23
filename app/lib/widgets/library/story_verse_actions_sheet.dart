import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/verse.dart';

/// What a reader can do with one verse of a story: the actions the verse-by-verse
/// layout shows as a row of buttons, as a list opened by pressing and holding.
/// Each tile closes the sheet first and then does its thing, so a sheet it opens
/// (notes, related verses) is not stacked on this one.
Future<void> showStoryVerseActions(
  BuildContext context, {
  required Verse verse,
  required bool isFavorite,
  required bool isHighlighted,
  required int noteCount,
  required VoidCallback onToggleFavorite,
  required VoidCallback onToggleHighlight,
  required VoidCallback onOpenNotes,
  required VoidCallback onOpenRelated,
  VoidCallback? onPlay,
  VoidCallback? onCompareTranslations,
}) {
  final text = AppLocalizations.of(context);

  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    backgroundColor: context.colors.surface,
    builder: (sheet) {
      Widget tile(
        IconData icon,
        String title,
        VoidCallback onTap, {
        String? trailing,
      }) => ListTile(
        leading: Icon(icon),
        title: Text(title),
        trailing: trailing == null ? null : Text(trailing),
        onTap: () {
          Navigator.of(sheet).pop();
          onTap();
        },
      );

      return SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  0,
                  AppSpacing.lg,
                  AppSpacing.xs,
                ),
                child: Text(
                  text.labelVerse(verse.verseNumber ?? 0),
                  style: AppTypography.eyebrow(
                    sheet,
                    color: sheet.colors.primary,
                  ),
                ),
              ),
              if (onPlay != null)
                tile(
                  Icons.play_arrow_rounded,
                  text.readingAudioPlayVerse,
                  onPlay,
                ),
              tile(
                isFavorite
                    ? Icons.bookmark_rounded
                    : Icons.bookmark_border_rounded,
                isFavorite ? text.actionRemoveBookmark : text.actionBookmark,
                onToggleFavorite,
              ),
              tile(
                isHighlighted
                    ? Icons.format_paint_rounded
                    : Icons.format_paint_outlined,
                isHighlighted
                    ? text.actionRemoveHighlight
                    : text.actionHighlight,
                onToggleHighlight,
              ),
              tile(
                Icons.edit_note_rounded,
                text.verseNotesTitle,
                onOpenNotes,
                trailing: noteCount > 0 ? '$noteCount' : null,
              ),
              if (onCompareTranslations != null)
                tile(
                  Icons.compare_arrows_rounded,
                  text.verseCompareTranslations,
                  onCompareTranslations,
                ),
              if (verse.relatedCount > 0)
                tile(Icons.link_rounded, text.verseRelatedTitle, onOpenRelated),
            ],
          ),
        ),
      );
    },
  );
}
