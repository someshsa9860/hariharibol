import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../data/models/verse_detail_model.dart';
import '../providers/home_provider.dart';

// ─── Palette ──────────────────────────────────────────────────────────────────
const _saffron = Color(0xFFFF7E00);
const _saffronDeep = Color(0xFFD96100);
const _krishnaBlue = Color(0xFF1A4D8F);
const _cream = Color(0xFFFFF8EC);
const _gold = Color(0xFFD4A04C);
const _textDark = Color(0xFF1A1410);
const _textMid = Color(0xFF8B7D73);

// ─── Page ─────────────────────────────────────────────────────────────────────
class VerseDetailPage extends ConsumerStatefulWidget {
  final String verseId;

  const VerseDetailPage({super.key, required this.verseId});

  @override
  ConsumerState<VerseDetailPage> createState() => _VerseDetailPageState();
}

class _VerseDetailPageState extends ConsumerState<VerseDetailPage> {
  bool _isFavorited = false;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(verseDetailProvider(widget.verseId));

    return Scaffold(
      backgroundColor: _cream,
      body: async.when(
        loading: _buildLoading,
        error: (err, _) => _buildError(err),
        data: _buildContent,
      ),
    );
  }

  Widget _buildLoading() {
    return const Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(_saffron),
      ),
    );
  }

  Widget _buildError(Object err) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
          onPressed: () => context.pop(),
        ),
      ),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 48),
            const SizedBox(height: 12),
            Text('Failed to load verse',
                style: Theme.of(context)
                    .textTheme
                    .bodyLarge
                    ?.copyWith(color: Colors.red)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.invalidate(verseDetailProvider(widget.verseId)),
              child: const Text('Try again'),
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
        // Scrollable body
        CustomScrollView(
          slivers: [
            _buildAppBar(verse),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Source chip
                    _SourceChip(verse: verse),
                    const SizedBox(height: 24),
                    // Sanskrit
                    _SanskritBlock(text: verse.sanskrit),
                    // Transliteration
                    if (verse.transliteration != null) ...[
                      const SizedBox(height: 20),
                      _TransliterationBlock(text: verse.transliteration!),
                    ],
                    // Translation
                    if (verse.translation != null) ...[
                      const SizedBox(height: 20),
                      _TranslationBlock(text: verse.translation!),
                    ],
                    // Word meanings
                    if (verse.wordMeanings.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      _WordMeaningsSection(meanings: verse.wordMeanings),
                    ],
                    // Narrations
                    if (verse.narrations.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      _NarrationsSection(narrations: verse.narrations),
                    ],
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
            verse: verse,
            isFavorited: _isFavorited,
            onFavoriteToggle: () => setState(() => _isFavorited = !_isFavorited),
            onShare: () => _shareVerse(verse),
            onAudio: () => _playAudio(verse),
            onOpenBook: () => context.push('/books/${verse.bookTitle}'),
          ),
        ),
      ],
    );
  }

  SliverAppBar _buildAppBar(VerseDetailModel verse) {
    return SliverAppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      pinned: true,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
        onPressed: () => context.pop(),
      ),
      title: const Text(
        'Verse Detail',
        style: TextStyle(
            color: _textDark, fontWeight: FontWeight.w600, fontSize: 16),
      ),
      actions: [
        IconButton(
          icon: Icon(
            _isFavorited ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            color: _saffron,
          ),
          onPressed: () => setState(() => _isFavorited = !_isFavorited),
        ),
        IconButton(
          icon: const Icon(Icons.share_rounded, color: _textDark),
          onPressed: () => _shareVerse(verse),
        ),
      ],
    );
  }

  void _shareVerse(VerseDetailModel verse) {
    final text =
        '${verse.sanskrit}\n\n${verse.transliteration ?? ''}\n\n${verse.translation ?? ''}\n\n— ${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}';
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Verse copied to clipboard'),
        backgroundColor: _saffronDeep,
      ),
    );
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
        content: Text('Playing: ${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}'),
        backgroundColor: _krishnaBlue,
      ),
    );
  }
}

// ─── Source Chip ──────────────────────────────────────────────────────────────
class _SourceChip extends StatelessWidget {
  final VerseDetailModel verse;
  const _SourceChip({required this.verse});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: _saffron.withOpacity(0.12),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _saffron.withOpacity(0.3)),
          ),
          child: Text(
            '${verse.bookTitle} ${verse.chapterNumber}:${verse.verseNumber}',
            style: const TextStyle(
              color: _saffronDeep,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        ...verse.categories.map(
          (cat) => Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: _krishnaBlue.withOpacity(0.08),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              cat,
              style: const TextStyle(
                color: _krishnaBlue,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Sanskrit Block ────────────────────────────────────────────────────────────
class _SanskritBlock extends StatelessWidget {
  final String text;
  const _SanskritBlock({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            _saffron.withOpacity(0.08),
            _gold.withOpacity(0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _gold.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🕉️', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 8),
              Text(
                'Sanskrit',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: _saffronDeep,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      letterSpacing: 0.8,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            text,
            style: const TextStyle(
              fontFamily: 'NotoSansDevanagari',
              fontSize: 22,
              color: _textDark,
              height: 1.9,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Transliteration Block ────────────────────────────────────────────────────
class _TransliterationBlock extends StatelessWidget {
  final String text;
  const _TransliterationBlock({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Transliteration',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: _textMid,
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                  letterSpacing: 0.8,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            text,
            style: const TextStyle(
              fontStyle: FontStyle.italic,
              fontSize: 15,
              color: _textDark,
              height: 1.7,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Translation Block ────────────────────────────────────────────────────────
class _TranslationBlock extends StatelessWidget {
  final String text;
  const _TranslationBlock({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Translation',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: _textMid,
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                  letterSpacing: 0.8,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            text,
            style: const TextStyle(
              fontSize: 16,
              color: _textDark,
              height: 1.7,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Word Meanings ────────────────────────────────────────────────────────────
class _WordMeaningsSection extends StatelessWidget {
  final List<WordMeaning> meanings;
  const _WordMeaningsSection({required this.meanings});

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding:
              const EdgeInsets.fromLTRB(16, 0, 16, 16),
          leading: const Icon(Icons.translate_rounded, color: _saffron),
          title: const Text(
            'Word Meanings',
            style: TextStyle(
                color: _textDark, fontWeight: FontWeight.w600, fontSize: 15),
          ),
          iconColor: _saffron,
          collapsedIconColor: _textMid,
          children: meanings
              .map((m) => Padding(
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
                              color: _textDark,
                              fontSize: 13,
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ))
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
        Text(
          'Narrations & Commentaries',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: _textDark,
              ),
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
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
                    color: _krishnaBlue.withOpacity(0.1),
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
                      color: _krishnaBlue,
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
                color: _textDark,
                fontSize: 14,
                height: 1.65,
              ),
            ),
            if (hasMore && !_expanded) ...[
              const SizedBox(height: 6),
              GestureDetector(
                onTap: () => setState(() => _expanded = true),
                child: const Text(
                  'Read more',
                  style: TextStyle(
                    color: _saffron,
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
  final VerseDetailModel verse;
  final bool isFavorited;
  final VoidCallback onFavoriteToggle;
  final VoidCallback onShare;
  final VoidCallback onAudio;
  final VoidCallback onOpenBook;

  const _BottomActionBar({
    required this.verse,
    required this.isFavorited,
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
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _ActionButton(
            icon: isFavorited
                ? Icons.favorite_rounded
                : Icons.favorite_border_rounded,
            label: 'Favorite',
            color: isFavorited ? Colors.red : _textMid,
            onTap: onFavoriteToggle,
          ),
          _ActionButton(
            icon: Icons.share_rounded,
            label: 'Share',
            color: _saffron,
            onTap: onShare,
          ),
          _ActionButton(
            icon: Icons.play_circle_rounded,
            label: 'Audio',
            color: _krishnaBlue,
            onTap: onAudio,
          ),
          _ActionButton(
            icon: Icons.menu_book_rounded,
            label: 'Open Book',
            color: _gold,
            onTap: onOpenBook,
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
              color: color.withOpacity(0.1),
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
