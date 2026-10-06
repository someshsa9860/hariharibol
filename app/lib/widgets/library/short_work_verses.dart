import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/book.dart';
import '../../models/verse.dart';
import '../../providers/book_provider.dart';
import '../../providers/reading_prefs_provider.dart';
import '../../services/favorite_service.dart';
import '../../services/verse_highlight_service.dart';
import '../common/app_error_view.dart';
import '../common/app_loader.dart';
import '../common/empty_state.dart';
import 'book_header.dart';
import 'related_verses_sheet.dart';
import 'translation_picker_sheet.dart';
import 'verse_block.dart';
import 'verse_notes_sheet.dart';

/// A short work's reading screen: the book header followed by every one of
/// its verses, in one call (`bookVersesProvider`) — the equivalent of
/// `ChapterReadView` for a stotra, aarti, prayer or poem, which has no
/// chapter to read into.
class ShortWorkVerses extends ConsumerStatefulWidget {
  const ShortWorkVerses({super.key, required this.book});

  final Book book;

  @override
  ConsumerState<ShortWorkVerses> createState() => _ShortWorkVersesState();
}

class _ShortWorkVersesState extends ConsumerState<ShortWorkVerses> {
  // Optimistic overlays: applied on top of what the last fetch returned, same
  // pattern as `ChapterReadView` — a tap on favourite/highlight/notes/compare
  // reflects instantly rather than waiting on (or forcing) a refetch.
  final Map<String, bool> _favoriteOverrides = {};
  final Map<String, String?> _favoriteIdOverrides = {};
  final Map<String, bool> _highlightOverrides = {};
  final Map<String, String?> _highlightIdOverrides = {};
  final Map<String, int> _noteCountOverrides = {};
  final Map<String, VerseTranslation> _translationOverrides = {};

  Future<void> _toggleFavorite(Verse verse) async {
    final wasFavorite = _favoriteOverrides[verse.id] ?? verse.isFavorite;
    final favoriteId = _favoriteIdOverrides[verse.id] ?? verse.favoriteId;
    setState(() => _favoriteOverrides[verse.id] = !wasFavorite);

    try {
      if (wasFavorite) {
        if (favoriteId != null) await FavoriteService.instance.remove(favoriteId);
        if (mounted) setState(() => _favoriteIdOverrides[verse.id] = null);
      } else {
        final favorite = await FavoriteService.instance.add(verseId: verse.id);
        if (mounted) setState(() => _favoriteIdOverrides[verse.id] = favorite.id);
      }
    } on ApiFailure catch (failure) {
      if (mounted) setState(() => _favoriteOverrides[verse.id] = wasFavorite);
      AppNavigator.instance.showFailure(failure);
    }
  }

  Future<void> _toggleHighlight(Verse verse) async {
    final wasHighlighted = _highlightOverrides[verse.id] ?? verse.isHighlighted;
    final highlightId = _highlightIdOverrides[verse.id] ?? verse.highlightId;
    setState(() => _highlightOverrides[verse.id] = !wasHighlighted);

    try {
      if (wasHighlighted) {
        if (highlightId != null) await VerseHighlightService.instance.remove(highlightId);
        if (mounted) setState(() => _highlightIdOverrides[verse.id] = null);
      } else {
        final id = await VerseHighlightService.instance.add(verse.id);
        if (mounted) setState(() => _highlightIdOverrides[verse.id] = id);
      }
    } on ApiFailure catch (failure) {
      if (mounted) setState(() => _highlightOverrides[verse.id] = wasHighlighted);
      AppNavigator.instance.showFailure(failure);
    }
  }

  void _openNotes(Verse verse) {
    showVerseNotesSheet(
      context,
      verseId: verse.id,
      onCountChanged: (count) {
        if (mounted) setState(() => _noteCountOverrides[verse.id] = count);
      },
    );
  }

  void _openRelated(Verse verse) => showRelatedVersesSheet(context, verseId: verse.verseId);

  Future<void> _compareTranslations(Verse verse) async {
    final picked = await showTranslationPickerSheet(context, verseId: verse.verseId);
    if (picked != null && mounted) setState(() => _translationOverrides[verse.id] = picked);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final verses = ref.watch(bookVersesProvider(widget.book.slug));
    final fontScale = ref.watch(readingFontSizeProvider).scale;

    return verses.when(
      loading: () => Column(
        children: [
          Padding(padding: AppSpacing.page.copyWith(bottom: 0), child: BookHeader(book: widget.book)),
          const Expanded(child: AppLoader()),
        ],
      ),
      error: (error, _) => AppErrorView(
        failure: error is ApiFailure
            ? error
            : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
        onRetry: () async => ref.invalidate(bookVersesProvider(widget.book.slug)),
      ),
      data: (list) => ListView.separated(
        padding: AppSpacing.page.copyWith(
          bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xxl,
        ),
        itemCount: list.isEmpty ? 2 : list.length + 1,
        separatorBuilder: (context, index) =>
            index == 0 ? const SizedBox(height: AppSpacing.lg) : const Divider(height: AppSpacing.xl),
        itemBuilder: (context, index) {
          if (index == 0) return BookHeader(book: widget.book);
          if (list.isEmpty) {
            return Center(child: EmptyState(message: text.comingSoon, icon: Icons.menu_book_outlined));
          }

          final verse = list[index - 1];
          return VerseBlock(
            verse: verse,
            fontScale: fontScale,
            isFavorite: _favoriteOverrides[verse.id] ?? verse.isFavorite,
            isHighlighted: _highlightOverrides[verse.id] ?? verse.isHighlighted,
            noteCount: _noteCountOverrides[verse.id] ?? verse.noteCount,
            translation: _translationOverrides[verse.id],
            onToggleFavorite: () => _toggleFavorite(verse),
            onToggleHighlight: () => _toggleHighlight(verse),
            onOpenNotes: () => _openNotes(verse),
            onOpenRelated: () => _openRelated(verse),
            onCompareTranslations:
                verse.availableTranslations.length > 1 ? () => _compareTranslations(verse) : null,
          );
        },
      ),
    );
  }
}
