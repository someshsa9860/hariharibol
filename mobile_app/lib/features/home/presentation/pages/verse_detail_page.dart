import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../data/models/verse_detail_model.dart';
import '../providers/home_provider.dart';

// ─── Palette ──────────────────────────────────────────────────────────────────
const _saffron = Color(0xFFFF6B00);
const _saffronDeep = Color(0xFFD96100);
const _maroon = Color(0xFF7B1C1C);
const _peacock = Color(0xFF006B6B);
const _gold = Color(0xFFD4A055);
const _textDark = Color(0xFF1C1209);
const _textMid = Color(0xFF7A6050);

// ─── Page ─────────────────────────────────────────────────────────────────────
class VerseDetailPage extends ConsumerStatefulWidget {
  final String verseId;
  const VerseDetailPage({super.key, required this.verseId});

  @override
  ConsumerState<VerseDetailPage> createState() => _VerseDetailPageState();
}

class _VerseDetailPageState extends ConsumerState<VerseDetailPage>
    with SingleTickerProviderStateMixin {
  bool _isFavorited = false;
  late AnimationController _heartController;
  late Animation<double> _heartScale;

  @override
  void initState() {
    super.initState();
    _heartController = AnimationController(
      duration: const Duration(milliseconds: 350),
      vsync: this,
    );
    _heartScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 1.35)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 1.35, end: 1.0)
            .chain(CurveTween(curve: Curves.bounceOut)),
        weight: 60,
      ),
    ]).animate(_heartController);
  }

  @override
  void dispose() {
    _heartController.dispose();
    super.dispose();
  }

  void _toggleFavorite() {
    setState(() => _isFavorited = !_isFavorited);
    _heartController.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(verseDetailProvider(widget.verseId));
    return Scaffold(
      backgroundColor: _maroon,
      body: async.when(
        loading: _buildLoading,
        error: (err, _) => _buildError(err),
        data: _buildContent,
      ),
    );
  }

  Widget _buildLoading() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [_saffron, _maroon],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: const Center(
        child: CircularProgressIndicator(color: Colors.white),
      ),
    );
  }

  Widget _buildError(Object err) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [_saffron, _maroon],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: Colors.white70, size: 48),
            const SizedBox(height: 12),
            const Text(
              'Failed to load verse',
              style: TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () =>
                  ref.invalidate(verseDetailProvider(widget.verseId)),
              child: const Text('Try again',
                  style: TextStyle(color: _gold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(VerseDetailModel verse) {
    if (_isFavorited != verse.isFavorited) {
      WidgetsBinding.instance.addPostFrameCallback(
          (_) => setState(() => _isFavorited = verse.isFavorited));
    }

    return Stack(
      children: [
        // Full-screen saffron-to-maroon gradient background
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_saffron, _maroon],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
        // Scrollable content
        CustomScrollView(
          slivers: [
            _buildSliverAppBar(verse),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Transliteration
                    if (verse.transliteration != null) ...[
                      _WhiteCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _CardLabel('Transliteration'),
                            const SizedBox(height: 8),
                            Text(
                              verse.transliteration!,
                              style: const TextStyle(
                                fontStyle: FontStyle.italic,
                                fontSize: 15,
                                color: _textDark,
                                height: 1.7,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],
                    // Meaning
                    if (verse.translation != null) ...[
                      _WhiteCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _CardLabel('Meaning'),
                            const SizedBox(height: 8),
                            Text(
                              verse.translation!,
                              style: const TextStyle(
                                fontSize: 16,
                                color: _textDark,
                                height: 1.7,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],
                    // AI Explanation — first narration with peacock left border
                    if (verse.narrations.isNotEmpty) ...[
                      _AiExplanationCard(narration: verse.narrations.first),
                      const SizedBox(height: 14),
                    ],
                    // Word meanings
                    if (verse.wordMeanings.isNotEmpty) ...[
                      _WordMeaningsCard(meanings: verse.wordMeanings),
                      const SizedBox(height: 14),
                    ],
                    // Additional narrations (skip first used as explanation)
                    if (verse.narrations.length > 1)
                      _NarrationsSection(
                          narrations: verse.narrations.sublist(1)),
                  ],
                ),
              ),
            ),
          ],
        ),
        // Bottom action bar
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: _BottomActionBar(
            isFavorited: _isFavorited,
            heartScale: _heartScale,
            onFavoriteToggle: _toggleFavorite,
            onShare: () => _shareVerse(verse),
            onAudio: () => _playAudio(verse),
            onOpenBook: () => context.push('/book/${verse.bookTitle}'),
          ),
        ),
      ],
    );
  }

  SliverAppBar _buildSliverAppBar(VerseDetailModel verse) {
    final now = DateTime.now();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final dateStr = '${now.day} ${months[now.month - 1]} ${now.year}';

    return SliverAppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      pinned: true,
      expandedHeight: 270,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
        onPressed: () => context.pop(),
      ),
      actions: [
        ScaleTransition(
          scale: _heartScale,
          child: IconButton(
            icon: Icon(
              _isFavorited
                  ? Icons.favorite_rounded
                  : Icons.favorite_border_rounded,
              color: _isFavorited ? Colors.red[300] : Colors.white,
            ),
            onPressed: _toggleFavorite,
          ),
        ),
        IconButton(
          icon: const Icon(Icons.share_rounded, color: Colors.white),
          onPressed: () => _shareVerse(verse),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 56, 16, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Row(
                  children: [
                    // Date chip in gold
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: _gold.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: _gold.withOpacity(0.5)),
                      ),
                      child: Text(
                        dateStr,
                        style: const TextStyle(
                          color: _gold,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                // Large Sanskrit text in white Noto Sans Devanagari
                if (verse.sanskrit.isNotEmpty)
                  Text(
                    verse.sanskrit,
                    style: const TextStyle(
                      fontFamily: 'NotoSansDevanagari',
                      fontSize: 20,
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      height: 1.8,
                    ),
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _shareVerse(VerseDetailModel verse) async {
    final ref =
        '${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}';
    final text = '🙏 $ref\n\n'
        '${verse.sanskrit}\n\n'
        '${verse.transliteration ?? ''}\n\n'
        '${verse.translation ?? ''}\n\n'
        'Shared via HariHariBol';
    try {
      await Share.share(text, subject: 'Verse: $ref');
    } catch (_) {
      Clipboard.setData(ClipboardData(text: text));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Verse copied to clipboard'),
            backgroundColor: _saffronDeep,
          ),
        );
      }
    }
  }

  void _playAudio(VerseDetailModel verse) {
    if (verse.audioUrl == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Audio not available for this verse'),
          backgroundColor: _textMid,
        ),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
            'Playing: ${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}'),
        backgroundColor: _peacock,
      ),
    );
  }
}

// ─── White Card ───────────────────────────────────────────────────────────────
class _WhiteCard extends StatelessWidget {
  final Widget child;
  const _WhiteCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.92),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _CardLabel extends StatelessWidget {
  final String text;
  const _CardLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        color: _textMid,
        fontSize: 10,
        fontWeight: FontWeight.bold,
        letterSpacing: 0.8,
      ),
    );
  }
}

// ─── AI Explanation Card (peacock left border) ────────────────────────────────
class _AiExplanationCard extends StatelessWidget {
  final NarrationModel narration;
  const _AiExplanationCard({required this.narration});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.92),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Peacock left accent border
            Container(
              width: 4,
              decoration: const BoxDecoration(
                color: _peacock,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: _peacock.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.auto_awesome,
                                  size: 11, color: _peacock),
                              SizedBox(width: 4),
                              Text(
                                'Commentary',
                                style: TextStyle(
                                  color: _peacock,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        Text(
                          narration.saintName,
                          style: const TextStyle(
                            color: _peacock,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      narration.fullText ?? narration.excerpt,
                      style: const TextStyle(
                        color: _textDark,
                        fontSize: 14,
                        height: 1.7,
                      ),
                      maxLines: 6,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Word Meanings Card ───────────────────────────────────────────────────────
class _WordMeaningsCard extends StatelessWidget {
  final List<WordMeaning> meanings;
  const _WordMeaningsCard({required this.meanings});

  @override
  Widget build(BuildContext context) {
    return _WhiteCard(
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(top: 8),
          leading:
              const Icon(Icons.translate_rounded, color: _peacock, size: 20),
          title: const Text(
            'Word Meanings',
            style: TextStyle(
                color: _textDark, fontWeight: FontWeight.w600, fontSize: 15),
          ),
          iconColor: _peacock,
          collapsedIconColor: _textMid,
          children: meanings
              .map(
                (m) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _saffron.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          m.word,
                          style: const TextStyle(
                            fontFamily: 'NotoSansDevanagari',
                            color: _saffronDeep,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          m.meaning,
                          style: const TextStyle(
                              color: _textDark, fontSize: 13, height: 1.5),
                        ),
                      ),
                    ],
                  ),
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}

// ─── Narrations ───────────────────────────────────────────────────────────────
class _NarrationsSection extends StatelessWidget {
  final List<NarrationModel> narrations;
  const _NarrationsSection({required this.narrations});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'More Narrations',
          style: TextStyle(
              color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 12),
        ...narrations.map((n) => _NarrationCard(narration: n)),
      ],
    );
  }
}

class _NarrationCard extends StatefulWidget {
  final NarrationModel narration;
  const _NarrationCard({required this.narration});

  @override
  State<_NarrationCard> createState() => _NarrationCardState();
}

class _NarrationCardState extends State<_NarrationCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final hasMore = widget.narration.fullText != null &&
        widget.narration.fullText != widget.narration.excerpt;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.92),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: _peacock.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Text('🧘', style: TextStyle(fontSize: 18)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    widget.narration.saintName,
                    style: const TextStyle(
                      color: _peacock,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
                if (hasMore)
                  GestureDetector(
                    onTap: () => setState(() => _expanded = !_expanded),
                    child: Icon(
                      _expanded
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                      color: _textMid,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              _expanded && widget.narration.fullText != null
                  ? widget.narration.fullText!
                  : widget.narration.excerpt,
              style: const TextStyle(
                  color: _textDark, fontSize: 14, height: 1.65),
            ),
            if (hasMore && !_expanded) ...[
              const SizedBox(height: 6),
              GestureDetector(
                onTap: () => setState(() => _expanded = true),
                child: const Text(
                  'Read more',
                  style: TextStyle(
                    color: _peacock,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Bottom Action Bar ────────────────────────────────────────────────────────
class _BottomActionBar extends StatelessWidget {
  final bool isFavorited;
  final Animation<double> heartScale;
  final VoidCallback onFavoriteToggle;
  final VoidCallback onShare;
  final VoidCallback onAudio;
  final VoidCallback onOpenBook;

  const _BottomActionBar({
    required this.isFavorited,
    required this.heartScale,
    required this.onFavoriteToggle,
    required this.onShare,
    required this.onAudio,
    required this.onOpenBook,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.35),
        border: Border(top: BorderSide(color: Colors.white.withOpacity(0.1))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _AnimatedFavoriteButton(
            isFavorited: isFavorited,
            scale: heartScale,
            onTap: onFavoriteToggle,
          ),
          _ActionButton(
            icon: Icons.share_rounded,
            label: 'Share',
            color: Colors.white,
            onTap: onShare,
          ),
          _ActionButton(
            icon: Icons.play_circle_rounded,
            label: 'Audio',
            color: Colors.white,
            onTap: onAudio,
          ),
          _ActionButton(
            icon: Icons.menu_book_rounded,
            label: 'View in Book',
            color: _gold,
            onTap: onOpenBook,
          ),
        ],
      ),
    );
  }
}

class _AnimatedFavoriteButton extends StatelessWidget {
  final bool isFavorited;
  final Animation<double> scale;
  final VoidCallback onTap;

  const _AnimatedFavoriteButton({
    required this.isFavorited,
    required this.scale,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ScaleTransition(
            scale: scale,
            child: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isFavorited
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                color: isFavorited ? Colors.red[300] : Colors.white,
                size: 22,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Favorite',
            style: TextStyle(
              color: isFavorited ? Colors.red[300] : Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
