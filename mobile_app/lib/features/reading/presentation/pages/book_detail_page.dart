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
  final List<_ChapterSummary> chapters;

  _BookDetail({
    required this.id,
    required this.title,
    this.coverUrl,
    required this.description,
    required this.totalChapters,
    required this.totalVerses,
    required this.chapters,
  });

  factory _BookDetail.fromJson(Map<String, dynamic> j) {
    final chaps = (j['chapters'] as List? ?? [])
        .map((c) => _ChapterSummary.fromJson(c as Map<String, dynamic>))
        .toList();
    return _BookDetail(
      id: j['id'] as String,
      title: (j['titleKey'] ?? j['title'] ?? 'Unknown').toString(),
      coverUrl: j['coverImageUrl'] as String? ?? j['coverUrl'] as String?,
      description: (j['descriptionKey'] ?? j['description'] ?? '').toString(),
      totalChapters: j['totalChapters'] as int? ?? chaps.length,
      totalVerses:
          j['totalVerses'] as int? ?? (j['_count']?['verses'] as int? ?? 0),
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

// ─── Page ─────────────────────────────────────────────────────────────────────

class BookDetailPage extends ConsumerWidget {
  final String bookId;
  const BookDetailPage({super.key, required this.bookId});

  static const _saffron = Color(0xFFC75A1A);
  static const _cream = Color(0xFFFFF8EC);
  static const _dark = Color(0xFF1A1410);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_bookDetailProvider(bookId));

    return Scaffold(
      backgroundColor: _cream,
      body: async.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: _saffron)),
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
        _buildAppBar(context, book),
        SliverToBoxAdapter(child: _buildBookHeader(book)),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
            child: Text(
              'Chapters (${book.chapters.length})',
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: _dark),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
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

  SliverAppBar _buildAppBar(BuildContext context, _BookDetail book) {
    return SliverAppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      pinned: true,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: _dark),
        onPressed: () => context.pop(),
      ),
      title: Text(
        book.title,
        style: const TextStyle(
            color: _dark, fontWeight: FontWeight.bold, fontSize: 16),
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  Widget _buildBookHeader(_BookDetail book) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
              color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 3))
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: book.coverUrl != null
                ? CachedNetworkImage(
                    imageUrl: book.coverUrl!,
                    width: 90,
                    height: 120,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => _coverPlaceholder(),
                  )
                : _coverPlaceholder(),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(book.title,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: _dark)),
                if (book.description.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    book.description,
                    style: const TextStyle(
                        color: Color(0xFF8B7D73), fontSize: 13, height: 1.5),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    _statChip('${book.totalChapters} Chapters'),
                    const SizedBox(width: 8),
                    if (book.totalVerses > 0)
                      _statChip('${book.totalVerses} Verses'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _coverPlaceholder() => Container(
        width: 90,
        height: 120,
        color: const Color(0xFFF5E6D3),
        child: const Center(child: Text('📜', style: TextStyle(fontSize: 32))),
      );

  Widget _statChip(String text) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: _saffron.withAlpha(25),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(text,
            style: const TextStyle(
                color: _saffron,
                fontSize: 11,
                fontWeight: FontWeight.bold)),
      );
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

  static const _saffron = Color(0xFFC75A1A);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(
              color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 2))
        ],
      ),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: _saffron.withAlpha(25),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              '${chapter.number}',
              style: const TextStyle(
                  color: _saffron,
                  fontWeight: FontWeight.bold,
                  fontSize: 15),
            ),
          ),
        ),
        title: Text(chapter.title,
            style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: Color(0xFF1A1410))),
        subtitle: chapter.verseCount > 0
            ? Text('${chapter.verseCount} verses',
                style: const TextStyle(
                    fontSize: 11, color: Color(0xFF8B7D73)))
            : null,
        trailing: const Icon(Icons.chevron_right,
            color: Color(0xFF8B7D73), size: 20),
        onTap: () =>
            context.push('/book/$bookId/chapter/${chapter.number}'),
      ),
    );
  }
}
