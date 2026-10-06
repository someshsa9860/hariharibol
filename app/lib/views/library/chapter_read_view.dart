import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/book.dart';
import '../../models/verse.dart';
import '../../providers/book_provider.dart';
import '../../providers/reading_prefs_provider.dart';
import '../../services/favorite_service.dart';
import '../../services/progress_service.dart';
import '../../services/verse_highlight_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/eyebrow.dart';
import '../../widgets/common/motif.dart';
import '../../widgets/library/reading_settings_sheet.dart';
import '../../widgets/library/related_verses_sheet.dart';
import '../../widgets/library/translation_picker_sheet.dart';
import '../../widgets/library/verse_block.dart';
import '../../widgets/library/verse_notes_sheet.dart';

/// The reading screen: a chapter and every verse in it, one call
/// (`chapterReadingProvider`) away — see `backend/controllers/app/book.js`'s
/// `chapter` handler, which resolves translation, purport and explanation
/// server side so this screen only has to render what it gets back.
class ChapterReadView extends ConsumerStatefulWidget {
  const ChapterReadView({
    super.key,
    required this.slug,
    required this.number,
    this.canto,
    this.targetVerseNumber,
  });

  final String slug;
  final int number;
  final int? canto;

  /// Where to land within the chapter, when someone tapped a specific verse
  /// rather than opening the chapter itself — "Verse of the day" and the mood
  /// sheet both send readers here this way.
  final int? targetVerseNumber;

  @override
  ConsumerState<ChapterReadView> createState() => _ChapterReadViewState();
}

class _ChapterReadViewState extends ConsumerState<ChapterReadView> {
  // Optimistic overlays: applied on top of what the last fetch returned, so a
  // tap on favourite/highlight/notes/compare reflects instantly rather than
  // waiting on (or forcing) a full chapter refetch.
  final Map<String, bool> _favoriteOverrides = {};
  final Map<String, String?> _favoriteIdOverrides = {};
  final Map<String, bool> _highlightOverrides = {};
  final Map<String, String?> _highlightIdOverrides = {};
  final Map<String, int> _noteCountOverrides = {};
  final Map<String, VerseTranslation> _translationOverrides = {};

  // One key per verse, so a specific verse can be scrolled to by its own
  // context rather than by an offset guessed from its index.
  final Map<String, GlobalKey> _verseKeys = {};

  bool _openProgressSaved = false;
  bool _scrolledToTarget = false;

  ({String slug, int number, int? canto}) get _chapterArgs =>
      (slug: widget.slug, number: widget.number, canto: widget.canto);

  ({String slug, int? canto}) get _siblingArgs => (slug: widget.slug, canto: widget.canto);

  Future<int?> _computeVersesRead({required bool includeCurrent}) async {
    try {
      final chapters = await ref.read(bookChaptersProvider(_siblingArgs).future);
      var sum = 0;
      for (final chapter in chapters) {
        if (chapter.number < widget.number) {
          sum += chapter.totalVerses;
        } else if (chapter.number == widget.number && includeCurrent) {
          sum += chapter.totalVerses;
        }
      }
      if (widget.canto != null) {
        final cantos = await ref.read(bookCantosProvider(widget.slug).future);
        for (final canto in cantos) {
          if (canto.number < widget.canto!) sum += canto.totalVerses;
        }
      }
      return sum;
    } catch (_) {
      // Best-effort — a reader's position matters far more than the exact
      // percentage, and neither should ever block the screen from reading.
      return null;
    }
  }

  /// Marks the chapter as reached the moment it loads, using its first verse
  /// — so leaving without finishing still resumes here next time.
  void _saveOpenProgress(ChapterReading reading) {
    if (_openProgressSaved || reading.verses.isEmpty) return;
    _openProgressSaved = true;
    final firstVerse = reading.verses.first;
    unawaited(
      _computeVersesRead(includeCurrent: false)
          .then((versesRead) => ProgressService.instance.save(firstVerse.verseId, versesRead: versesRead))
          .catchError((_) {}),
    );
  }

  /// Scrolls to [ChapterReadView.targetVerseNumber] once the chapter carrying
  /// it has loaded. Runs at most once per screen — a rebuild triggered by,
  /// say, toggling a favourite must not yank the reader back to where they
  /// tapped in from.
  void _scrollToTarget(ChapterReading reading) {
    final target = widget.targetVerseNumber;
    if (_scrolledToTarget || target == null) return;
    final verse = reading.verses.where((v) => v.verseNumber == target).firstOrNull;
    if (verse == null) return;
    _scrolledToTarget = true;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final key = _verseKeys[verse.id];
      final targetContext = key?.currentContext;
      if (targetContext == null) return;
      Scrollable.ensureVisible(
        targetContext,
        duration: AppDurations.normal,
        curve: Curves.easeOut,
        alignment: 0.1,
      );
    });
  }

  Future<void> _goToChapter(ChapterReading current, int targetNumber) async {
    if (current.verses.isNotEmpty) {
      final lastVerse = current.verses.last;
      final versesRead = await _computeVersesRead(includeCurrent: true);
      unawaited(ProgressService.instance.save(lastVerse.verseId, versesRead: versesRead).catchError((_) {}));
    }
    if (!mounted) return;
    AppNavigator.instance.push(AppRoutes.chapterPath(widget.slug, targetNumber, canto: widget.canto));
  }

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
    final reading = ref.watch(chapterReadingProvider(_chapterArgs));
    final fontScale = ref.watch(readingFontSizeProvider).scale;
    final siblingChapters = ref.watch(bookChaptersProvider(_siblingArgs)).value ?? const <BookSection>[];
    final chapterNumbers = siblingChapters.map((c) => c.number).toSet();
    final hasPrevious = chapterNumbers.contains(widget.number - 1);
    final hasNext = chapterNumbers.contains(widget.number + 1);
    final readingData = reading.value;
    final bookTitle = readingData != null && readingData.verses.isNotEmpty
        ? readingData.verses.first.book?.title
        : null;

    return Scaffold(
      appBar: AppBar(
        title: readingData != null
            ? _ChapterAppBarTitle(chapter: readingData.chapter, bookTitle: bookTitle ?? '')
            : null,
        actions: [
          IconButton(
            icon: const Icon(Icons.tune_rounded),
            tooltip: text.readingSettingsTitle,
            onPressed: () => showReadingSettingsSheet(
              context,
              onLanguageChanged: () => ref.invalidate(chapterReadingProvider(_chapterArgs)),
            ),
          ),
        ],
      ),
      body: reading.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure
              ? error
              : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
          onRetry: () async => ref.invalidate(chapterReadingProvider(_chapterArgs)),
        ),
        data: (data) {
          _saveOpenProgress(data);
          _scrollToTarget(data);

          return ListView.separated(
            padding: AppSpacing.page.copyWith(
              bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xxl,
            ),
            itemCount: data.verses.length + 2,
            separatorBuilder: (context, index) =>
                index == 0 ? const SizedBox(height: AppSpacing.lg) : const Divider(height: AppSpacing.xl),
            itemBuilder: (context, index) {
              if (index == 0) {
                return _ChapterHeader(chapter: data.chapter, bookTitle: bookTitle ?? '');
              }
              if (index == data.verses.length + 1) {
                return _ChapterNav(
                  hasPrevious: hasPrevious,
                  hasNext: hasNext,
                  onPrevious: () => _goToChapter(data, widget.number - 1),
                  onNext: () => _goToChapter(data, widget.number + 1),
                );
              }

              final verse = data.verses[index - 1];
              return KeyedSubtree(
                key: _verseKeys.putIfAbsent(verse.id, () => GlobalKey()),
                child: VerseBlock(
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
                ),
              );
            },
          );
        },
      ),
    );
  }
}

/// "Canto 1 · Chapter 1", or just "Chapter 1" for a book with no cantos —
/// shared by the header card and the app bar title so the two never drift.
String _chapterNumbering(AppLocalizations text, BookSection chapter) => chapter.cantoNumber != null
    ? '${text.labelCanto(chapter.cantoNumber!)} · ${text.labelChapter(chapter.number)}'
    : text.labelChapter(chapter.number);

/// The app bar title while a chapter is loaded: the book name as an eyebrow
/// over "Canto N · Chapter N", so the reader still knows where they are once
/// the header card below has scrolled out of view.
class _ChapterAppBarTitle extends StatelessWidget {
  const _ChapterAppBarTitle({required this.chapter, required this.bookTitle});

  final BookSection chapter;
  final String bookTitle;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (bookTitle.isNotEmpty) ...[
          Eyebrow(bookTitle, color: context.colors.primary),
          const SizedBox(height: AppSpacing.xs),
        ],
        Text(_chapterNumbering(text, chapter), style: context.texts.titleMedium),
      ],
    );
  }
}

/// The gradient-panel banner at the top of the chapter — the same
/// `MotifPanel` treatment `VerseHeroCard` and a coverless `BookCard` use, not
/// a new one.
class _ChapterHeader extends StatelessWidget {
  const _ChapterHeader({required this.chapter, required this.bookTitle});

  final BookSection chapter;
  final String bookTitle;

  static const double _panelWidth = 96;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final isLight = context.theme.brightness == Brightness.light;
    final motif = Motif.values[chapter.number.abs() % Motif.values.length];
    final summary = chapter.summary?.trim();
    final numbering = _chapterNumbering(text, chapter);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (bookTitle.isNotEmpty) Eyebrow(bookTitle, color: context.colors.primary),
                    const SizedBox(height: AppSpacing.sm),
                    Text(numbering, style: context.texts.bodySmall),
                    const SizedBox(height: AppSpacing.xs),
                    Text(chapter.title, style: context.texts.headlineSmall),
                    if (summary != null && summary.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        summary,
                        style: context.texts.bodyMedium,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            SizedBox(
              width: _panelWidth,
              child: MotifPanel(
                motif: motif,
                from: isLight ? AppColors.panelFrom : AppColors.panelFromDark,
                to: isLight ? AppColors.panelTo : AppColors.panelToDark,
                lineColor: context.colors.primary,
                lineOpacity: isLight ? 0.45 : 0.60,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChapterNav extends StatelessWidget {
  const _ChapterNav({
    required this.hasPrevious,
    required this.hasNext,
    required this.onPrevious,
    required this.onNext,
  });

  final bool hasPrevious;
  final bool hasNext;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    if (!hasPrevious && !hasNext) return const SizedBox.shrink();
    final text = AppLocalizations.of(context);

    return Row(
      children: [
        if (hasPrevious)
          Expanded(
            child: OutlinedButton.icon(
              onPressed: onPrevious,
              icon: const Icon(Icons.arrow_back_rounded),
              label: Text(text.chapterPrevious),
            ),
          ),
        if (hasPrevious && hasNext) const SizedBox(width: AppSpacing.md),
        if (hasNext)
          Expanded(
            child: FilledButton.icon(
              onPressed: onNext,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: Text(text.chapterNext),
            ),
          ),
      ],
    );
  }
}
