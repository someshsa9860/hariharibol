import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../models/book_reel.dart';
import '../common/app_image.dart';
import 'verse_reel_page_split.dart';

export 'verse_reel_page_split.dart';

/// A book reel: one verse drawn by the app, page by page — Sanskrit with its
/// transliteration, the meaning, then the purport over as many pages as it
/// needs — and a segmented bar on top that fills as each page is read, like a
/// story. A page lasts as long as it takes to read ([BookReelStyle.wordsPerSecond],
/// never under [BookReelStyle.minPageSeconds]); tap the right side for the next
/// page, the left for the previous one, hold to pause. Past the last page
/// [onEnded] is called, which is how the feed moves on to the next reel.
class VerseReelPages extends StatefulWidget {
  const VerseReelPages({
    super.key,
    required this.content,
    required this.style,
    required this.isActive,
    this.onEnded,
    this.rightInset = 0,
    this.bottomInset = 0,
  });

  final VerseReelContent content;
  final BookReelStyle style;
  final bool isActive;
  final VoidCallback? onEnded;

  /// Room kept for the action rail; zero when the rail is hidden.
  final double rightInset;
  final double bottomInset;

  @override
  State<VerseReelPages> createState() => _VerseReelPagesState();
}

class _VerseReelPagesState extends State<VerseReelPages> with SingleTickerProviderStateMixin {
  late final AnimationController _timer = AnimationController(vsync: this)..addStatusListener(_onTimer);

  int _index = 0;
  int _pageCount = 1;
  bool _held = false;

  /// Moves on each time the reel leaves the screen, so the next visit starts
  /// on a fresh first page rather than cross-fading back from where it was.
  int _visit = 0;

  // Pagination is measured, so it is kept until the size or the words change.
  List<VersePage>? _pages;
  Object? _pagesKey;

  @override
  void initState() {
    super.initState();
    _timer.value = 0;
  }

  @override
  void didUpdateWidget(covariant VerseReelPages oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive != oldWidget.isActive) {
      if (widget.isActive) {
        _start();
      } else {
        _timer.stop();
        _index = 0;
        _timer.value = 0;
        _visit++;
      }
    }
  }

  @override
  void dispose() {
    _timer.dispose();
    super.dispose();
  }

  void _onTimer(AnimationStatus status) {
    if (status == AnimationStatus.completed) _next();
  }

  /// Runs the current page's clock.
  void _start() {
    final pages = _pages;
    if (pages == null || !widget.isActive || _held) return;
    final style = widget.style;
    final seconds = math.max(style.minPageSeconds, pages[_index].wordCount / style.wordsPerSecond);
    _timer.duration = Duration(milliseconds: (seconds * 1000).round());
    _timer.forward(from: 0);
  }

  void _go(int index) {
    setState(() => _index = index);
    _timer.stop();
    _start();
  }

  void _next() {
    if (!mounted) return;
    if (_index + 1 < _pageCount) {
      _go(_index + 1);
    } else {
      _timer.stop();
      widget.onEnded?.call();
    }
  }

  void _previous() {
    if (_index > 0) {
      _go(_index - 1);
    } else {
      _timer.forward(from: 0);
    }
  }

  void _hold(bool held) {
    _held = held;
    if (held) {
      _timer.stop();
    } else if (widget.isActive) {
      _timer.forward();
    }
  }

  List<VersePage> _paginate(BoxConstraints box, BuildContext context) {
    final content = widget.content;
    final style = widget.style;
    final key = Object.hash(box.maxWidth.round(), box.maxHeight.round(), style.textScale, content.purport, content.meaning, content.sanskrit);
    if (_pages != null && _pagesKey == key) return _pages!;

    final pages = <VersePage>[
      if (content.hasVerseLines)
        VersePage(VersePageKind.verse, sanskrit: content.sanskrit, transliteration: content.transliteration),
      if ((content.meaning ?? '').isNotEmpty) VersePage(VersePageKind.meaning, text: content.meaning),
    ];

    final purport = content.purport;
    if (purport != null && purport.isNotEmpty) {
      final pieces = splitPurport(
        purport,
        style: _bodyStyle(context, style.purportColor, 0.95),
        // The same padding the page draws with.
        width: math.max(box.maxWidth - 2 * AppSpacing.lg - widget.rightInset, 120),
        maxHeight: math.max(box.maxHeight - _chromeTop - _chromeBottom - widget.bottomInset - 56, 120),
        direction: Directionality.of(context),
        scaler: MediaQuery.textScalerOf(context),
      );
      for (var i = 0; i < pieces.length; i++) {
        pages.add(VersePage(VersePageKind.purport, text: pieces[i], part: i, parts: pieces.length));
      }
    }
    if (pages.isEmpty) pages.add(const VersePage(VersePageKind.meaning, text: ''));

    _pagesKey = key;
    _pages = pages;
    _pageCount = pages.length;
    if (_index >= pages.length) _index = pages.length - 1;
    // Measured during a build, so the clock starts once it is over.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && widget.isActive && !_timer.isAnimating && !_held) _start();
    });
    return pages;
  }

  static const double _chromeTop = 72;
  static const double _chromeBottom = 24;

  TextStyle _bodyStyle(BuildContext context, Color color, double factor) {
    final base = Theme.of(context).textTheme.titleMedium!;
    return base.copyWith(
      fontFamily: null,
      fontSize: 20 * factor * widget.style.textScale,
      height: 1.65,
      fontWeight: FontWeight.w400,
      color: color,
    );
  }

  @override
  Widget build(BuildContext context) {
    final style = widget.style;

    return Stack(
      fit: StackFit.expand,
      children: [
        _Background(style: style),
        LayoutBuilder(
          builder: (context, box) {
            final pages = _paginate(box, context);
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapUp: (details) {
                // The left third goes back, the rest goes on.
                if (details.localPosition.dx < box.maxWidth / 3) {
                  _previous();
                } else {
                  _next();
                }
              },
              onLongPressStart: (_) => _hold(true),
              onLongPressEnd: (_) => _hold(false),
              onLongPressCancel: () => _hold(false),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // A reel built ahead of a swipe holds its page still and lets
                  // it rise in when it comes on screen.
                  TickerMode(
                    enabled: widget.isActive,
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(
                        AppSpacing.lg,
                        _chromeTop,
                        AppSpacing.lg + widget.rightInset,
                        _chromeBottom + widget.bottomInset,
                      ),
                      child: AnimatedSwitcher(
                        key: ValueKey(_visit),
                        duration: const Duration(milliseconds: 520),
                        switchInCurve: Curves.easeOutCubic,
                        switchOutCurve: Curves.easeInCubic,
                        transitionBuilder: (child, animation) => FadeTransition(
                          opacity: animation,
                          child: SlideTransition(
                            position: Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero).animate(animation),
                            child: ScaleTransition(scale: Tween<double>(begin: 0.97, end: 1).animate(animation), child: child),
                          ),
                        ),
                        child: _PageBody(
                          key: ValueKey('$_index'),
                          page: pages[_index],
                          style: style,
                          bodyStyle: _bodyStyle,
                          content: widget.content,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 0,
                    left: AppSpacing.md,
                    right: AppSpacing.md,
                    child: SafeArea(
                      bottom: false,
                      child: Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.sm),
                        child: RepaintBoundary(
                          child: _Segments(count: pages.length, index: _index, timer: _timer, color: style.accentColor),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

/// One page, with its blocks rising in one after another.
class _PageBody extends StatefulWidget {
  const _PageBody({
    super.key,
    required this.page,
    required this.style,
    required this.bodyStyle,
    required this.content,
  });

  final VersePage page;
  final BookReelStyle style;
  final TextStyle Function(BuildContext, Color, double) bodyStyle;
  final VerseReelContent content;

  @override
  State<_PageBody> createState() => _PageBodyState();
}

class _PageBodyState extends State<_PageBody> with SingleTickerProviderStateMixin {
  late final AnimationController _in = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..forward();

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  /// Block [n] of the page: fades and rises a little after the one before.
  Widget _stagger(int n, Widget child) {
    final start = (n * 0.22).clamp(0.0, 0.7);
    final animation = CurvedAnimation(parent: _in, curve: Interval(start, math.min(start + 0.5, 1), curve: Curves.easeOutCubic));
    return FadeTransition(
      opacity: animation,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.12), end: Offset.zero).animate(animation),
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final page = widget.page;
    final style = widget.style;
    final scale = style.textScale;
    final blocks = <Widget>[];

    switch (page.kind) {
      case VersePageKind.verse:
        if ((page.sanskrit ?? '').isNotEmpty) {
          blocks.add(_stagger(
            blocks.length,
            Text(
              page.sanskrit!,
              textAlign: TextAlign.center,
              style: AppTypography.verse(context, size: 24, scale: scale).copyWith(color: style.sanskritColor, height: 1.75, fontWeight: FontWeight.w600),
            ),
          ));
        }
        if ((page.transliteration ?? '').isNotEmpty) {
          blocks
            ..add(const SizedBox(height: AppSpacing.lg))
            ..add(_stagger(
              blocks.length,
              Text(
                page.transliteration!,
                textAlign: TextAlign.center,
                style: AppTypography.transliteration(context, scale: scale).copyWith(color: style.transliterationColor),
              ),
            ));
        }
      case VersePageKind.meaning:
        blocks.add(_stagger(
          0,
          Text(
            page.text ?? '',
            textAlign: TextAlign.center,
            style: widget.bodyStyle(context, style.meaningColor, 1.15).copyWith(fontWeight: FontWeight.w500),
          ),
        ));
      case VersePageKind.purport:
        blocks.add(_stagger(
          0,
          Text(
            page.text ?? '',
            textAlign: TextAlign.start,
            style: widget.bodyStyle(context, style.purportColor, 0.95),
          ),
        ));
    }

    return Column(
      mainAxisAlignment: page.kind == VersePageKind.purport ? MainAxisAlignment.start : MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (style.showReference && (widget.content.label ?? '').isNotEmpty) ...[
          _stagger(
            0,
            Text(
              widget.content.label!,
              textAlign: TextAlign.center,
              style: AppTypography.eyebrow(context, color: style.accentColor),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (page.kind == VersePageKind.purport && page.parts > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Text(
              page.parts > 1 ? '${page.part + 1} / ${page.parts}' : '',
              textAlign: TextAlign.center,
              style: AppTypography.eyebrow(context, color: style.accentColor),
            ),
          ),
        if (page.kind == VersePageKind.purport)
          Expanded(child: SingleChildScrollView(physics: const NeverScrollableScrollPhysics(), child: Column(children: blocks)))
        else
          ...blocks,
      ],
    );
  }
}

/// The bar along the top: one segment per page, the current one filling as its time runs.
class _Segments extends StatelessWidget {
  const _Segments({required this.count, required this.index, required this.timer, required this.color});

  final int count;
  final int index;
  final Animation<double> timer;
  final Color color;

  Widget _bar(double value) => LinearProgressIndicator(
        value: value,
        minHeight: 3,
        backgroundColor: color.withValues(alpha: 0.25),
        valueColor: AlwaysStoppedAnimation(color),
      );

  /// Only the running segment follows the clock; the others are drawn once.
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < count; i++) ...[
          if (i > 0) const SizedBox(width: 3),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: SizedBox(
                height: 3,
                child: i == index
                    ? AnimatedBuilder(animation: timer, builder: (context, _) => _bar(timer.value))
                    : _bar(i < index ? 1 : 0),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Background extends StatelessWidget {
  const _Background({required this.style});

  final BookReelStyle style;

  @override
  Widget build(BuildContext context) {
    switch (style.background) {
      case BookReelBackground.solid:
        return ColoredBox(color: style.colorTop);
      case BookReelBackground.image:
        return Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: style.colorTop),
            AppImage(
              url: style.imageUrl,
              cacheKey: style.imageCacheKey,
              borderRadius: BorderRadius.zero,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
            ),
            ColoredBox(color: Colors.black.withValues(alpha: style.imageDim / 100)),
          ],
        );
      case BookReelBackground.gradient:
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [style.colorTop, style.colorBottom],
            ),
          ),
        );
    }
  }
}
