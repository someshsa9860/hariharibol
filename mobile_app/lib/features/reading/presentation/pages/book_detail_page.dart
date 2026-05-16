import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';

// ─── Models ──────────────────────────────────────────────────────────────────

class _BookDetail {
  final String id;
  final String title;
  final String? coverUrl;
  final String description;
  final int totalChapters;
  final int totalVerses;
  final String? translatorName;
  final List<_ChapterSummary> chapters;

  _BookDetail({
    required this.id,
    required this.title,
    this.coverUrl,
    required this.description,
    required this.totalChapters,
    required this.totalVerses,
    this.translatorName,
    required this.chapters,
  });

  factory _BookDetail.fromJson(Map<String, dynamic> j) {
    final chaps = (j['chapters'] as List? ?? [])
        .map((c) => _ChapterSummary.fromJson(c as Map<String, dynamic>))
        .toList();

    String? translatorName;
    final translators = j['translators'] as List?;
    if (translators != null && translators.isNotEmpty) {
      final t = translators.first as Map<String, dynamic>;
      translatorName = (t['nameKey'] ?? t['name'] ?? '').toString();
      if (translatorName!.isEmpty) translatorName = null;
    }

    return _BookDetail(
      id: j['id'] as String,
      title: (j['titleKey'] ?? j['title'] ?? 'Unknown').toString(),
      coverUrl: j['coverImageUrl'] as String? ?? j['coverUrl'] as String?,
      description: (j['descriptionKey'] ?? j['description'] ?? '').toString(),
      totalChapters: j['totalChapters'] as int? ?? chaps.length,
      totalVerses:
          j['totalVerses'] as int? ?? (j['_count']?['verses'] as int? ?? 0),
      translatorName: translatorName,
      chapters: chaps,
    );
  }
}

class _ChapterSummary {
  final String id;
  final int number;
  final String title;
  final int verseCount;

  _ChapterSummary({
    required this.id,
    required this.number,
    required this.title,
    required this.verseCount,
  });

  factory _ChapterSummary.fromJson(Map<String, dynamic> j) => _ChapterSummary(
        id: j['id'] as String,
        number: j['number'] as int,
        title: (j['titleKey'] ?? 'Chapter ${j['number']}').toString(),
        verseCount:
            (j['_count']?['verses'] as int? ?? j['totalVerses'] as int? ?? 0),
      );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

final _bookDetailProvider =
    FutureProvider.family<_BookDetail, String>((ref, bookId) async {
  final dio = ApiClient.createDio();
  final res = await dio.get('/api/v1/books/$bookId');
  return _BookDetail.fromJson(res.data as Map<String, dynamic>);
});

// ─── Palette ──────────────────────────────────────────────────────────────────

const _saffron = Color(0xFFC75A1A);
const _maroon = Color(0xFF7B1C1C);
const _sandstone = Color(0xFFC4A882);
const _gold = Color(0xFFD4A055);
const _cream = Color(0xFFFFF8EC);
const _dark = Color(0xFF1A1410);
const _mid = Color(0xFF8B7D73);

// ─── Page ─────────────────────────────────────────────────────────────────────

class BookDetailPage extends ConsumerWidget {
  final String bookId;
  const BookDetailPage({super.key, required this.bookId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_bookDetailProvider(bookId));

    return Scaffold(
      backgroundColor: _cream,
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(color: _saffron)),
        error: (e, _) => _buildError(context, ref),
        data: (book) => _buildContent(context, book),
      ),
    );
  }

  Widget _buildError(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: _dark),
          onPressed: () => context.pop(),
        ),
      ),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 48),
            const SizedBox(height: 12),
            const Text('Could not load book',
                style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => ref.invalidate(_bookDetailProvider(bookId)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, _BookDetail book) {
    return CustomScrollView(
      slivers: [
        _buildHeroAppBar(context, book),
        SliverToBoxAdapter(child: _buildAboutSection(book)),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
            child: Row(
              children: [
                Text(
                  'Chapters',
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: _dark),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: _gold.withAlpha(40),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _gold.withAlpha(80)),
                  ),
                  child: Text(
                    '${book.chapters.length}',
                    style: const TextStyle(
                        color: _gold, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (ctx, i) => _ChapterTile(
                bookId: book.id,
                chapter: book.chapters[i],
                totalChapters: book.totalChapters,
              ),
              childCount: book.chapters.length,
            ),
          ),
        ),
      ],
    );
  }

  SliverAppBar _buildHeroAppBar(BuildContext context, _BookDetail book) {
    return SliverAppBar(
      expandedHeight: 300,
      pinned: true,
      backgroundColor: _maroon,
      elevation: 0,
      leading: IconButton(
        icon: Container(
          decoration: BoxDecoration(
            color: Colors.black26,
            shape: BoxShape.circle,
          ),
          padding: const EdgeInsets.all(4),
          child: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 20),
        ),
        onPressed: () => context.pop(),
      ),
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: [
            // Cover image or gradient placeholder
            book.coverUrl != null
                ? CachedNetworkImage(
                    imageUrl: book.coverUrl!,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => _coverGradient(),
                  )
                : _coverGradient(),
            // Gradient overlay at bottom for text legibility
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black87],
                  stops: [0.35, 1.0],
                ),
              ),
            ),
            // Title and translator over image
            Positioned(
              bottom: 20,
              left: 20,
              right: 20,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    book.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.3,
                      height: 1.2,
                    ),
                  ),
                  if (book.translatorName != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.person_rounded,
                            color: Colors.white60, size: 14),
                        const SizedBox(width: 4),
                        Text(
                          book.translatorName!,
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 13),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      if (book.totalChapters > 0)
                        _heroPill('${book.totalChapters} Chapters'),
                      if (book.totalChapters > 0 && book.totalVerses > 0)
                        const SizedBox(width: 8),
                      if (book.totalVerses > 0)
                        _heroPill('${book.totalVerses} Verses'),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _coverGradient() => Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF7B1C1C), Color(0xFFC75A1A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: const Center(child: Text('📜', style: TextStyle(fontSize: 64))),
      );

  Widget _heroPill(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(30),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white30),
        ),
        child: Text(text,
            style: const TextStyle(
                color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
      );

  Widget _buildAboutSection(_BookDetail book) {
    if (book.description.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _sandstone.withAlpha(45),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _sandstone.withAlpha(100)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'About this Book',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: _maroon,
            ),
          ),
          const SizedBox(height: 10),
          _ExpandableText(text: book.description),
        ],
      ),
    );
  }
}

// ─── Expandable description ───────────────────────────────────────────────────

class _ExpandableText extends StatefulWidget {
  final String text;
  const _ExpandableText({required this.text});

  @override
  State<_ExpandableText> createState() => _ExpandableTextState();
}

class _ExpandableTextState extends State<_ExpandableText> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final isLong = widget.text.length > 180;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.text,
          style: const TextStyle(
              color: _mid, fontSize: 14, height: 1.65),
          maxLines: _expanded || !isLong ? null : 4,
          overflow: _expanded || !isLong ? null : TextOverflow.ellipsis,
        ),
        if (isLong) ...[
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Text(
              _expanded ? 'Show less' : 'Read more',
              style: const TextStyle(
                  color: _saffron, fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ],
    );
  }
}

// ─── Chapter tile ─────────────────────────────────────────────────────────────

class _ChapterTile extends StatelessWidget {
  final String bookId;
  final _ChapterSummary chapter;
  final int totalChapters;

  const _ChapterTile({
    required this.bookId,
    required this.chapter,
    required this.totalChapters,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 2))
        ],
      ),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          width: 42,
          height: 42,
          decoration: const BoxDecoration(
            color: _saffron,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              '${chapter.number}',
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 15),
            ),
          ),
        ),
        title: Text(chapter.title,
            style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: _dark)),
        subtitle: chapter.verseCount > 0
            ? Row(
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _gold.withAlpha(30),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: _gold.withAlpha(80)),
                    ),
                    child: Text(
                      '${chapter.verseCount} verses',
                      style: const TextStyle(
                          fontSize: 10,
                          color: _gold,
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              )
            : null,
        trailing: const Icon(Icons.chevron_right, color: _mid, size: 20),
        onTap: () => context.push('/book/$bookId/chapter/${chapter.number}'),
      ),
    );
  }
}
