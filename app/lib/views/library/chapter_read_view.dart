import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/book.dart';
import '../../models/reading_mode.dart';
import '../../models/reading_place.dart';
import '../../models/verse.dart';
import '../../providers/book_provider.dart';
import '../../providers/language_settings_provider.dart';
import '../../providers/reading_audio_provider.dart';
import '../../providers/reading_place_provider.dart';
import '../../providers/reading_prefs_provider.dart';
import '../../services/audio/reading_audio.dart';
import '../../services/audio/reading_playback_controller.dart';
import '../../services/favorite_service.dart';
import '../../services/progress_service.dart';
import '../../services/verse_highlight_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/library/chapter_header.dart';
import '../../widgets/library/chapter_index_sheet.dart';
import '../../widgets/library/chapter_nav.dart';
import '../../widgets/library/reading_audio_controls.dart';
import '../../widgets/library/reading_settings_sheet.dart';
import '../../widgets/library/related_verses_sheet.dart';
import '../../widgets/library/story_part_bar.dart';
import '../../widgets/library/story_verse.dart';
import '../../widgets/library/story_verse_actions_sheet.dart';
import '../../widgets/library/reveal_list_item.dart';
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

  // Verses of a story the reader tapped open into the verse-by-verse layout.
  final Set<String> _openVerses = {};

  // One key per verse, so a specific verse can be scrolled to by its own
  // context rather than by an offset guessed from its index.
  final Map<String, GlobalKey> _verseKeys = {};

  bool _openProgressSaved = false;
  bool _scrolledToTarget = false;
  bool _placeRemembered = false;

  // The chapter's verses as last drawn, and the verse the reader is on. Held
  // here because dispose can no longer ask the list where it has scrolled to.
  List<Verse> _verses = const [];
  Verse? _currentVerse;

  // Where down the screen the verse being read sits. A verse opened at is
  // scrolled to this line, and the verse on this line is the one remembered,
  // so reopening a chapter lands where it was left instead of a verse earlier.
  static const double _readingLine = 0.1;

  // Reading aloud. Held here so dispose can stop it without touching `ref`.
  late final ReadingAudio _audio = ref.read(readingAudioProvider);
  String? _preparedFor;

  String get _audioContext => '${widget.slug}:${widget.canto ?? 0}:${widget.number}';

  @override
  void dispose() {
    // Leaving the chapter ends its reading; the lock screen has nothing to show.
    if (_audio.controller.context == _audioContext) unawaited(_audio.stop());
    _saveLeavingProgress();
    super.dispose();
  }

  /// Gives the player this chapter's verses. The recitation is the same whatever
  /// language is being read, so nothing here follows the language settings.
  void _prepareAudio(ChapterReading data) {
    final key = '$_audioContext:${data.verses.length}';
    if (_preparedFor == key) return;
    _preparedFor = key;
    _audio.prepare(data.verses, context: _audioContext);
    if (mounted) setState(() {});
  }

  Future<void> _playVerse(ChapterReading data, int index) async {
    final channel = AppLocalizations.of(context).readingAudioChannel;
    _prepareAudio(data);
    await _audio.playVerse(index, channelName: channel);
  }

  void _followPlayback(ReadingState? previous, ReadingState next) {
    if (!next.autoplay || next.verseId == null || next.verseId == previous?.verseId) return;
    final targetContext = _verseKeys[next.verseId]?.currentContext;
    if (targetContext == null) return;
    Scrollable.ensureVisible(targetContext, duration: AppDurations.normal, curve: Curves.easeOut, alignment: 0.1);
  }

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

  /// Remembers where the reader is in this book, so tapping the book later
  /// opens here. Runs once, as the chapter loads — at the verse they were sent
  /// to, or the first — and again each time they stop scrolling.
  void _rememberPlace(Verse verse) {
    final number = verse.verseNumber;
    if (number == null) return;
    _currentVerse = verse;
    ref
        .read(readingPlacesProvider.notifier)
        .remember(widget.slug, ReadingPlace(canto: widget.canto, chapter: widget.number, verse: number));
  }

  void _rememberOpenedPlace(ChapterReading reading) {
    if (_placeRemembered || reading.verses.isEmpty) return;
    _placeRemembered = true;
    final target = widget.targetVerseNumber;
    final opened = reading.verses.firstWhere(
      (verse) => verse.verseNumber == target,
      orElse: () => reading.verses.first,
    );
    // Not during the build that is drawing the chapter.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _rememberPlace(opened);
    });
  }

  /// A reader who has stopped scrolling by hand. The notification only fires for
  /// the person's own scrolling, never for the scroll to a target verse or to
  /// the verse being recited, so those cannot move the remembered place.
  bool _onUserScroll(UserScrollNotification notification) {
    if (notification.direction != ScrollDirection.idle) return false;
    final verse = _verseOnReadingLine(notification.metrics);
    if (verse != null) _rememberPlace(verse);
    return false;
  }

  /// The last verse whose top has reached the reading line. Judged in scroll
  /// offsets — where each verse sits in the list — rather than where it is drawn,
  /// because a list that is still settling draws things where they will not stay.
  /// Only verses near the screen are built, and the one on the line is among them.
  Verse? _verseOnReadingLine(ScrollMetrics metrics) {
    Verse? found;
    for (final verse in _verses) {
      final box = _verseKeys[verse.id]?.currentContext?.findRenderObject();
      if (box == null || !box.attached) continue;
      final viewport = RenderAbstractViewport.maybeOf(box);
      if (viewport == null) continue;
      final offset = viewport.getOffsetToReveal(box, _readingLine).offset;
      if (offset <= metrics.pixels + 1) found = verse;
    }
    return found ?? (_verses.isEmpty ? null : _verses.first);
  }

  /// Tells the account where the reader got to, so the Home tab's "Continue
  /// reading" agrees with the Read tab. `versesRead` is left out: it only ever
  /// goes up server side, and is worked out where a chapter is finished.
  void _saveLeavingProgress() {
    final verse = _currentVerse;
    if (verse == null || _verses.isEmpty || verse.id == _verses.first.id) return;
    unawaited(ProgressService.instance.save(verse.verseId).catchError((_) {}));
  }

  /// Scrolls to [ChapterReadView.targetVerseNumber] once the chapter carrying
  /// it has loaded. Runs at most once per screen — a rebuild triggered by,
  /// say, toggling a favourite must not yank the reader back to where they
  /// tapped in from.
  ///
  /// The list builds only what is near the screen, so a verse far down has no
  /// widget yet; [revealListItem] walks toward it until it does. Item 0 is the
  /// chapter header, so the verse at position n is item n + 1.
  void _scrollToTarget(ChapterReading reading) {
    final target = widget.targetVerseNumber;
    if (_scrolledToTarget || target == null) return;
    final at = reading.verses.indexWhere((v) => v.verseNumber == target);
    if (at < 0) return;
    _scrolledToTarget = true;

    BuildContext? contextAt(int item) {
      final position = item - 1;
      if (position < 0 || position >= reading.verses.length) return null;
      return _verseKeys[reading.verses[position].id]?.currentContext;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(revealListItem(
        index: at + 1,
        itemCount: reading.verses.length + 2,
        contextAt: contextAt,
        duration: AppDurations.normal,
        curve: Curves.easeOut,
        alignment: _readingLine,
      ));
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

  // Only a verse with a recording can be played; the meaning is never read out.
  bool _canPlay(Verse verse) => verse.hasAudio;

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

  /// Opens Ask Sakha with this verse in the first message — the verse as the reader sees it (the rendering picked under
  /// "Compare translations" if there is one) and where it comes from, so Sakha explains that verse and not another.
  void _askSakha(Verse verse, String? bookTitle) {
    final text = AppLocalizations.of(context);
    final number = verse.verseNumberEnd != null ? '${verse.verseNumber}-${verse.verseNumberEnd}' : '${verse.verseNumber ?? ''}';
    final place = [if (widget.canto != null) '${widget.canto}', '${widget.number}', number].join('.');
    final reference = [if (bookTitle != null && bookTitle.isNotEmpty) bookTitle, place].join(' ');
    final meaning = (_translationOverrides[verse.id] ?? verse.translation)?.meaning?.trim();
    final body = [verse.sanskrit?.trim(), meaning].where((part) => part != null && part.isNotEmpty).join('\n\n');
    // The chat takes a few thousand characters; a very long verse is cut rather than refused.
    final clipped = body.length > 1500 ? '${body.substring(0, 1500)}…' : body;
    AppNavigator.instance.push(AppRoutes.chat, extra: text.chatExplainVerse(reference, clipped));
  }

  void _openRelated(Verse verse) => showRelatedVersesSheet(context, verseId: verse.verseId);

  void _openStoryActions(ChapterReading data, int at) {
    final verse = data.verses[at];
    showStoryVerseActions(
      context,
      verse: verse,
      isFavorite: _favoriteOverrides[verse.id] ?? verse.isFavorite,
      isHighlighted: _highlightOverrides[verse.id] ?? verse.isHighlighted,
      noteCount: _noteCountOverrides[verse.id] ?? verse.noteCount,
      onPlay: _canPlay(verse) ? () => _playVerse(data, at) : null,
      onToggleFavorite: () => _toggleFavorite(verse),
      onToggleHighlight: () => _toggleHighlight(verse),
      onOpenNotes: () => _openNotes(verse),
      onOpenRelated: () => _openRelated(verse),
      onCompareTranslations: verse.availableTranslations.length > 1 ? () => _compareTranslations(verse) : null,
    );
  }

  void _keepPlace() => WidgetsBinding.instance.addPostFrameCallback((_) {
        final shown = _verseKeys[_currentVerse?.id]?.currentContext;
        if (mounted && shown != null) Scrollable.ensureVisible(shown, alignment: _readingLine);
      });

  Future<void> _compareTranslations(Verse verse) async {
    final picked = await showTranslationPickerSheet(context, verseId: verse.verseId);
    if (picked != null && mounted) setState(() => _translationOverrides[verse.id] = picked);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final reading = ref.watch(chapterReadingProvider(_chapterArgs));
    final playback = ref.watch(readingStateProvider).value ?? const ReadingState();
    ref.listen(readingStateProvider, (previous, next) {
      final state = next.value;
      if (state != null) _followPlayback(previous?.value, state);
    });
    // A rendering picked under "Compare translations" belongs to the language it
    // was picked in: choosing another reading language shows that language's own,
    // not the acharya still pinned from the one before.
    ref.listen(languageSettingsProvider.select((s) => s.reading), (previous, next) {
      if (previous != next && _translationOverrides.isNotEmpty && mounted) {
        setState(_translationOverrides.clear);
      }
    });
    ref.listen(readingModeProvider, (_, _) {
      if (_openVerses.isNotEmpty) setState(_openVerses.clear);
      _keepPlace();
    });
    ref.listen(storyPartProvider, (_, _) => _keepPlace());
    final story = ref.watch(readingModeProvider) == ReadingMode.story;
    final (storyPart, storyNumbers) = (ref.watch(storyPartProvider), ref.watch(storyNumbersProvider));
    final fontScale = ref.watch(readingFontSizeProvider).scale;
    final hiddenParts = ref.watch(hiddenVersePartsProvider);
    final siblingChapters = ref.watch(bookChaptersProvider(_siblingArgs)).value ?? const <BookSection>[];
    final chapterNumbers = siblingChapters.map((c) => c.number).toSet();
    final hasPrevious = chapterNumbers.contains(widget.number - 1);
    final hasNext = chapterNumbers.contains(widget.number + 1);
    final readingData = reading.value;
    final bookTitle = readingData != null && readingData.verses.isNotEmpty
        ? readingData.verses.first.book?.title
        : null;
    void openContents() => openChapterIndex(context,
        slug: widget.slug, bookTitle: bookTitle ?? '', chapter: widget.number, canto: widget.canto);

    return Scaffold(
      appBar: AppBar(
        title: readingData != null
            ? ChapterAppBarTitle(chapter: readingData.chapter, bookTitle: bookTitle ?? '', onTap: openContents)
            : null,
        actions: [
          IconButton(icon: const Icon(Icons.format_list_bulleted_rounded), tooltip: text.readingContents, onPressed: openContents),
          const ReadingAudioAction(),
          IconButton(
            icon: const Icon(Icons.tune_rounded),
            tooltip: text.readingSettingsTitle,
            onPressed: () => showReadingSettingsSheet(context, bookSlug: widget.slug),
          ),
        ],
      ),
      bottomNavigationBar: const ReadingPlayerBar(),
      body: reading.when(
        // A new reading language reloads the chapter; keep the verses on screen
        // (and where the reader had scrolled to) until the new text is ready.
        skipLoadingOnReload: true,
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure
              ? error
              : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
          onRetry: () async => ref.invalidate(chapterReadingProvider(_chapterArgs)),
        ),
        data: (data) {
          _verses = data.verses;
          _saveOpenProgress(data);
          _rememberOpenedPlace(data);
          _scrollToTarget(data);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _prepareAudio(data);
          });

          return NotificationListener<UserScrollNotification>(
            onNotification: _onUserScroll,
            child: ListView.separated(
              padding: AppSpacing.page.copyWith(
                bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xxl,
              ),
              itemCount: data.verses.length + 2,
              separatorBuilder: (context, index) => story
                  ? SizedBox(height: storyGapAfter(index, data.verses.length))
                  : index == 0
                      ? const SizedBox(height: AppSpacing.lg)
                      : const Divider(height: AppSpacing.xl),
              itemBuilder: (context, index) {
                if (index == 0) {
                  final header = ChapterHeader(chapter: data.chapter, bookTitle: bookTitle ?? '');
                  return story ? StoryPartBar(header: header, verses: data.verses, translations: _translationOverrides) : header;
                }
                if (index == data.verses.length + 1) {
                  return ChapterNav(
                    hasPrevious: hasPrevious,
                    hasNext: hasNext,
                    onPrevious: () => _goToChapter(data, widget.number - 1),
                    onNext: () => _goToChapter(data, widget.number + 1),
                  );
                }

                final verse = data.verses[index - 1];
                // A verse tapped open in a story is the verse-by-verse layout in
                // full (Sanskrit, word meanings, purport), whatever the reader hid.
                final opened = story && _openVerses.contains(verse.id);
                return KeyedSubtree(
                  key: _verseKeys.putIfAbsent(verse.id, () => GlobalKey()),
                  child: story && !opened
                      ? StoryVerse(
                          verse: verse,
                          part: storyPart,
                          fontScale: fontScale,
                          showNumber: storyNumbers,
                          isFavorite: _favoriteOverrides[verse.id] ?? verse.isFavorite,
                          isHighlighted: _highlightOverrides[verse.id] ?? verse.isHighlighted,
                          playing: playback.isActive && playback.verseId == verse.id,
                          translation: _translationOverrides[verse.id],
                          onTap: () => setState(() => _openVerses.add(verse.id)),
                          onLongPress: () => _openStoryActions(data, index - 1),
                        )
                      : VerseBlock(
                    verse: verse,
                    fontScale: fontScale,
                    hidden: opened ? const {} : hiddenParts,
                    onCollapse: opened ? () => setState(() => _openVerses.remove(verse.id)) : null,
                    isFavorite: _favoriteOverrides[verse.id] ?? verse.isFavorite,
                    isHighlighted: _highlightOverrides[verse.id] ?? verse.isHighlighted,
                    noteCount: _noteCountOverrides[verse.id] ?? verse.noteCount,
                    translation: _translationOverrides[verse.id],
                    onToggleFavorite: () => _toggleFavorite(verse),
                    onToggleHighlight: () => _toggleHighlight(verse),
                    onOpenNotes: () => _openNotes(verse),
                    onOpenRelated: () => _openRelated(verse),
                    onAskSakha: () => _askSakha(verse, bookTitle),
                    onStartReels: verse.bookNumber <= 2
                        ? () => AppNavigator.instance.push(AppRoutes.bookReelsPath(verse.verseId))
                        : null,
                    onCompareTranslations:
                        verse.availableTranslations.length > 1 ? () => _compareTranslations(verse) : null,
                    onPlay: _canPlay(verse) ? () => _playVerse(data, index - 1) : null,
                    playing: playback.isActive && playback.verseId == verse.id,
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
