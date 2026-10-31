import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/book.dart';
import '../../providers/book_provider.dart';
import '../../providers/language_chain_provider.dart';
import '../common/app_error_view.dart';
import '../common/app_loader.dart';
import '../common/eyebrow.dart';
import 'reveal_list_item.dart';

/// A chapter picked in the contents sheet. [canto] is null for a book without
/// cantos, the Gita.
typedef ChapterPick = ({int? canto, int chapter});

/// Opens the book's contents over the chapter being read and goes to the
/// chapter picked there. The new chapter replaces this one, so back still leads
/// to where the reader came from, not through every chapter they jumped to.
Future<void> openChapterIndex(
  BuildContext context, {
  required String slug,
  required String bookTitle,
  required int chapter,
  int? canto,
}) async {
  final pick = await showChapterIndexSheet(context, slug: slug, bookTitle: bookTitle, chapter: chapter, canto: canto);
  if (pick == null || (pick.canto == canto && pick.chapter == chapter)) return;
  unawaited(AppNavigator.instance.replace(AppRoutes.chapterPath(slug, pick.chapter, canto: pick.canto)));
}

/// The contents as a sheet: the Gita's chapters, or the Bhagavatam's cantos
/// and then the chapters of the canto chosen. The place being read is marked
/// "Reading now" and scrolled into view. Returns the chapter picked.
Future<ChapterPick?> showChapterIndexSheet(
  BuildContext context, {
  required String slug,
  required String bookTitle,
  required int chapter,
  int? canto,
}) {
  return showModalBottomSheet<ChapterPick>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    builder: (context) => _ChapterIndexSheet(slug: slug, bookTitle: bookTitle, chapter: chapter, canto: canto),
  );
}

class _ChapterIndexSheet extends ConsumerStatefulWidget {
  const _ChapterIndexSheet({required this.slug, required this.bookTitle, required this.chapter, this.canto});

  final String slug;
  final String bookTitle;
  final int chapter;
  final int? canto;

  @override
  ConsumerState<_ChapterIndexSheet> createState() => _ChapterIndexSheetState();
}

class _ChapterIndexSheetState extends ConsumerState<_ChapterIndexSheet> {
  // How much of the screen the sheet takes. Fixed, so moving between the two
  // steps does not make it jump in height.
  static const double _heightShare = 0.8;

  // The canto whose chapters are showing. Null on the Bhagavatam's canto step,
  // and always null for the Gita, which has only the chapter step.
  BookSection? _canto;

  bool get _onCantos => widget.canto != null && _canto == null;

  void _pickChapter(BookSection chapter) =>
      Navigator.of(context).pop<ChapterPick>((canto: _canto?.number, chapter: chapter.number));

  void _openBookPage() {
    Navigator.of(context).pop();
    AppNavigator.instance.push(AppRoutes.bookPath(widget.slug));
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    // Kept while a canto's chapters are open, so going back does not load the
    // cantos again.
    if (widget.canto != null) ref.watch(bookCantosProvider(widget.slug));
    final step = _onCantos ? _cantoStep(text) : _chapterStep(text);
    final stepKey = ValueKey(_onCantos ? 'cantos' : 'chapters-${_canto?.number}');
    final still = MediaQuery.disableAnimationsOf(context);

    return SafeArea(
      top: false,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * _heightShare,
        child: AnimatedSwitcher(
          duration: still ? Duration.zero : AppDurations.normal,
          layoutBuilder: (current, previous) => Stack(
            fit: StackFit.expand,
            children: [...previous, ?current],
          ),
          // The step coming in slides a little from the side it is reached
          // from — chapters from the right, cantos back from the left — and the
          // one leaving only fades.
          transitionBuilder: (child, animation) {
            final fade = FadeTransition(opacity: animation, child: child);
            if (child.key != stepKey) return fade;
            final slide = Tween(begin: Offset(_onCantos ? -0.06 : 0.06, 0), end: Offset.zero)
                .chain(CurveTween(curve: Curves.easeOutCubic));
            return SlideTransition(position: animation.drive(slide), child: fade);
          },
          child: KeyedSubtree(key: stepKey, child: step),
        ),
      ),
    );
  }

  Widget _aboutButton(AppLocalizations text) => IconButton(
        icon: const Icon(Icons.info_outline_rounded),
        tooltip: text.readingContentsAboutBook,
        onPressed: _openBookPage,
      );

  Widget _cantoStep(AppLocalizations text) {
    final cantos = ref.watch(bookCantosProvider(widget.slug));
    final count = cantos.value?.length;

    return Column(
      children: [
        _Header(
          eyebrow: widget.bookTitle,
          title: text.readingContents,
          count: count == null ? null : text.bookCantoCount(count),
          trailing: _aboutButton(text),
        ),
        Expanded(
          child: _SectionList(
            sections: cantos,
            current: widget.canto,
            labelFor: text.labelCanto,
            factsFor: (canto) => [
              if (canto.totalChapters != null) text.bookChapterCount(canto.totalChapters!),
              text.bookVerseCount(canto.totalVerses),
            ],
            opensMore: true,
            onPick: (canto) => setState(() => _canto = canto),
            onRetry: () => ref.invalidate(bookCantosProvider(widget.slug)),
          ),
        ),
      ],
    );
  }

  Widget _chapterStep(AppLocalizations text) {
    final canto = _canto;
    final args = (slug: widget.slug, canto: canto?.number);
    final chapters = ref.watch(bookChaptersProvider(args));
    final count = chapters.value?.length;

    return Column(
      children: [
        _Header(
          eyebrow: canto == null ? widget.bookTitle : text.labelCanto(canto.number),
          title: canto == null ? text.readingContents : canto.titleFor(ref.watch(readingChainProvider)),
          count: count == null ? null : text.bookChapterCount(count),
          onBack: canto == null ? null : () => setState(() => _canto = null),
          trailing: canto == null ? _aboutButton(text) : null,
        ),
        Expanded(
          child: _SectionList(
            sections: chapters,
            current: canto?.number == widget.canto ? widget.chapter : null,
            labelFor: text.labelChapter,
            factsFor: (chapter) => [text.bookVerseCount(chapter.totalVerses)],
            onPick: _pickChapter,
            onRetry: () => ref.invalidate(bookChaptersProvider(args)),
          ),
        ),
      ],
    );
  }
}

/// The top of a step: where it is (the book, or "Canto 3") over what it lists,
/// and how many there are.
class _Header extends StatelessWidget {
  const _Header({required this.eyebrow, required this.title, this.count, this.onBack, this.trailing});

  final String eyebrow;
  final String title;
  final String? count;
  final VoidCallback? onBack;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(onBack == null ? AppSpacing.xl : AppSpacing.sm, 0, AppSpacing.md, AppSpacing.md),
      child: Row(
        children: [
          if (onBack != null)
            IconButton(icon: const Icon(Icons.arrow_back_rounded), tooltip: text.actionBack, onPressed: onBack),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (eyebrow.isNotEmpty) ...[
                  Eyebrow(eyebrow, color: context.colors.primary),
                  const SizedBox(height: AppSpacing.xs),
                ],
                Text(title, style: context.texts.headlineSmall),
                if (count != null) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(count!, style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant)),
                ],
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// One step's rows, once they have loaded, with the row being read brought
/// into view as they first appear.
class _SectionList extends ConsumerStatefulWidget {
  const _SectionList({
    required this.sections,
    required this.current,
    required this.labelFor,
    required this.factsFor,
    required this.onPick,
    required this.onRetry,
    this.opensMore = false,
  });

  final AsyncValue<List<BookSection>> sections;

  /// The number of the row being read, when it is in this list.
  final int? current;
  final String Function(int number) labelFor;
  final List<String> Function(BookSection section) factsFor;
  final ValueChanged<BookSection> onPick;
  final VoidCallback onRetry;

  /// A canto leads on to its chapters, so its row carries a chevron.
  final bool opensMore;

  @override
  ConsumerState<_SectionList> createState() => _SectionListState();
}

class _SectionListState extends ConsumerState<_SectionList> {
  // Where the row being read comes to rest: a few rows show above it, so the
  // reader sees where they are and what came before.
  static const double _currentAlignment = 0.3;

  final Map<int, GlobalKey> _keys = {};
  bool _revealed = false;

  void _revealCurrent(List<BookSection> sections) {
    if (_revealed) return;
    _revealed = true;
    final at = sections.indexWhere((section) => section.number == widget.current);
    if (at <= 0) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(revealListItem(
        index: at,
        itemCount: sections.length,
        contextAt: (index) =>
            index < 0 || index >= sections.length ? null : _keys[sections[index].number]?.currentContext,
        duration: Duration.zero,
        curve: Curves.linear,
        alignment: _currentAlignment,
      ));
    });
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final chain = ref.watch(readingChainProvider);

    return widget.sections.when(
      loading: () => const AppLoader(),
      error: (error, _) => AppErrorView(
        failure: error is ApiFailure ? error : ApiFailure(kind: FailureKind.unknown, message: text.errorGeneric),
        onRetry: () async => widget.onRetry(),
      ),
      data: (sections) {
        _revealCurrent(sections);
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(AppSpacing.sm, 0, AppSpacing.sm, AppSpacing.lg),
          itemCount: sections.length,
          separatorBuilder: (context, index) => const Divider(
            height: 1,
            indent: AppSpacing.md * 2 + AppSizes.avatarMd,
            endIndent: AppSpacing.md,
          ),
          itemBuilder: (context, index) {
            final section = sections[index];
            return _IndexRow(
              key: _keys.putIfAbsent(section.number, GlobalKey.new),
              number: section.number,
              label: widget.labelFor(section.number),
              title: section.titleFor(chain),
              facts: widget.factsFor(section),
              current: section.number == widget.current,
              opensMore: widget.opensMore,
              onTap: () => widget.onPick(section),
            );
          },
        );
      },
    );
  }
}

/// A row of the contents: its number in the serif figures, its title and what
/// is inside it. The row being read sits on a tinted plane and says "Reading
/// now", so the colour is never the only sign of it.
class _IndexRow extends StatelessWidget {
  const _IndexRow({
    super.key,
    required this.number,
    required this.label,
    required this.title,
    required this.facts,
    required this.current,
    required this.opensMore,
    required this.onTap,
  });

  final int number;
  final String label;
  final String title;
  final List<String> facts;
  final bool current;
  final bool opensMore;
  final VoidCallback onTap;

  static const double _numberSize = 24;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final colors = context.colors;
    final accent = current ? colors.onPrimaryContainer : colors.primary;

    return Semantics(
      button: true,
      selected: current,
      label: [label, title, if (current) text.readingContentsNow, ...facts].join(', '),
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: current ? colors.primaryContainer : Colors.transparent,
        borderRadius: AppRadius.mdAll,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                SizedBox(
                  width: AppSizes.avatarMd,
                  child: Text(
                    '$number',
                    textAlign: TextAlign.center,
                    style: AppTypography.numeral(context, size: _numberSize).copyWith(color: accent),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (current) ...[
                        Eyebrow(text.readingContentsNow, color: accent),
                        const SizedBox(height: AppSpacing.xxs),
                      ],
                      Text(title, style: context.texts.titleMedium),
                      const SizedBox(height: AppSpacing.xxs),
                      Wrap(
                        spacing: AppSpacing.md,
                        runSpacing: AppSpacing.xxs,
                        children: [
                          for (final fact in facts)
                            Text(fact, style: context.texts.bodySmall?.copyWith(color: colors.onSurfaceVariant)),
                        ],
                      ),
                    ],
                  ),
                ),
                if (opensMore) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Icon(Icons.chevron_right_rounded, color: colors.onSurfaceVariant),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
