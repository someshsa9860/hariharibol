import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';

// ─── Models ──────────────────────────────────────────────────────────────────

class _Translation {
  final String language;
  final String translatorName;
  final String meaning;
  final String? purport;

  _Translation({
    required this.language,
    required this.translatorName,
    required this.meaning,
    this.purport,
  });

  factory _Translation.fromJson(Map<String, dynamic> j) {
    final translator = j['translator'] as Map<String, dynamic>?;
    return _Translation(
      language: j['language'] as String? ?? 'en',
      translatorName: (translator?['nameKey'] ?? translator?['name'] ?? 'Unknown').toString(),
      meaning: j['meaning'] as String? ?? '',
      purport: j['purport'] as String?,
    );
  }
}

class _Narration {
  final String id;
  final String saintName;
  final String text;

  _Narration({required this.id, required this.saintName, required this.text});

  factory _Narration.fromJson(Map<String, dynamic> j) => _Narration(
        id: j['id'] as String? ?? '',
        saintName:
            (j['saintNameKey'] ?? j['saintName'] ?? 'Unknown').toString(),
        text: (j['narrationKey'] ?? j['text'] ?? '').toString(),
      );
}

class _Verse {
  final String id;
  final int verseNumber;
  final String? sanskrit;
  final String? transliteration;
  final List<_Translation> translations;
  final List<_Narration> narrations;
  final List<Map<String, String>> wordMeanings;

  _Verse({
    required this.id,
    required this.verseNumber,
    this.sanskrit,
    this.transliteration,
    required this.translations,
    required this.narrations,
    required this.wordMeanings,
  });

  factory _Verse.fromJson(Map<String, dynamic> j) => _Verse(
        id: j['id'] as String? ?? '',
        verseNumber: j['verseNumber'] as int? ?? 0,
        sanskrit: j['sanskrit'] as String?,
        transliteration: j['transliteration'] as String?,
        translations: (j['translations'] as List? ?? [])
            .map((e) => _Translation.fromJson(e as Map<String, dynamic>))
            .toList(),
        narrations: (j['narrations'] as List? ?? [])
            .map((e) => _Narration.fromJson(e as Map<String, dynamic>))
            .toList(),
        wordMeanings: (j['wordMeanings'] as List? ?? [])
            .map((e) => Map<String, String>.from(
                (e as Map).map((k, v) => MapEntry(k.toString(), v.toString()))))
            .toList(),
      );
}

class _Chapter {
  final String id;
  final int number;
  final String title;
  final String bookId;
  final String bookTitle;
  final int totalChapters;
  final List<_Verse> verses;

  _Chapter({
    required this.id,
    required this.number,
    required this.title,
    required this.bookId,
    required this.bookTitle,
    required this.totalChapters,
    required this.verses,
  });

  factory _Chapter.fromJson(Map<String, dynamic> j) {
    final book = j['book'] as Map<String, dynamic>? ?? {};
    return _Chapter(
      id: j['id'] as String? ?? '',
      number: j['number'] as int? ?? 0,
      title: (j['titleKey'] ?? 'Chapter ${j['number']}').toString(),
      bookId: book['id'] as String? ?? '',
      bookTitle: (book['titleKey'] ?? book['title'] ?? 'Book').toString(),
      totalChapters: book['totalChapters'] as int? ?? 0,
      verses: (j['verses'] as List? ?? [])
          .map((e) => _Verse.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

typedef _ChapterKey = ({String bookId, int chapterNum});

final _chapterProvider =
    FutureProvider.family<_Chapter, _ChapterKey>((ref, key) async {
  final dio = ApiClient.createDio();
  final res =
      await dio.get('/api/v1/books/${key.bookId}/chapters/${key.chapterNum}');
  return _Chapter.fromJson(res.data as Map<String, dynamic>);
});

// ─── Page ─────────────────────────────────────────────────────────────────────

class ChapterReadingPage extends ConsumerWidget {
  final String bookId;
  final int chapterNum;

  const ChapterReadingPage({
    super.key,
    required this.bookId,
    required this.chapterNum,
  });

  static const _saffron = Color(0xFFC75A1A);
  static const _cream = Color(0xFFFFF8EC);
  static const _dark = Color(0xFF1A1410);
  static const _mid = Color(0xFF8B7D73);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (bookId: bookId, chapterNum: chapterNum);
    final async = ref.watch(_chapterProvider(key));

    return Scaffold(
      backgroundColor: _cream,
      body: async.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: _saffron)),
        error: (e, _) => _buildError(context, ref),
        data: (chapter) => _buildContent(context, ref, chapter),
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
            const Text('Could not load chapter',
                style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => ref.invalidate(
                  _chapterProvider((bookId: bookId, chapterNum: chapterNum))),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(
      BuildContext context, WidgetRef ref, _Chapter chapter) {
    return Stack(
      children: [
        CustomScrollView(
          slivers: [
            _buildAppBar(context, chapter),
            SliverToBoxAdapter(
                child: _buildChapterHeader(chapter)),
            if (chapter.verses.isEmpty)
              const SliverFillRemaining(
                child: Center(
                  child: Text('No verses available',
                      style: TextStyle(color: _mid)),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) => _VerseCard(verse: chapter.verses[i]),
                    childCount: chapter.verses.length,
                  ),
                ),
              ),
          ],
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: _buildNavBar(context, chapter),
        ),
      ],
    );
  }

  SliverAppBar _buildAppBar(BuildContext context, _Chapter chapter) {
    return SliverAppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      pinned: true,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: _dark),
        onPressed: () => context.pop(),
      ),
      title: Text(
        chapter.bookTitle,
        style: const TextStyle(
            color: _dark, fontWeight: FontWeight.bold, fontSize: 16),
        overflow: TextOverflow.ellipsis,
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.menu_book_rounded, color: _saffron),
          onPressed: () => context.push('/book/${chapter.bookId}'),
          tooltip: 'All Chapters',
        ),
      ],
    );
  }

  Widget _buildChapterHeader(_Chapter chapter) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF3D1A00), Color(0xFF8B3A00)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(30),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                '${chapter.number}',
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 18),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Chapter',
                    style: TextStyle(color: Colors.white60, fontSize: 12)),
                Text(
                  chapter.title,
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16),
                ),
                if (chapter.verses.isNotEmpty)
                  Text(
                    '${chapter.verses.length} verses',
                    style: const TextStyle(
                        color: Colors.white60, fontSize: 12),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavBar(BuildContext context, _Chapter chapter) {
    final hasPrev = chapter.number > 1;
    final hasNext = chapter.totalChapters == 0 ||
        chapter.number < chapter.totalChapters;

    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
              color: Color(0x14000000),
              blurRadius: 16,
              offset: Offset(0, -4))
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: hasPrev
                  ? () => context.pushReplacement(
                      '/book/$bookId/chapter/${chapterNum - 1}')
                  : null,
              icon: const Icon(Icons.arrow_back_rounded, size: 18),
              label: const Text('Previous'),
              style: OutlinedButton.styleFrom(
                foregroundColor: _saffron,
                side: const BorderSide(color: _saffron),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: hasNext
                  ? () => context.pushReplacement(
                      '/book/$bookId/chapter/${chapterNum + 1}')
                  : null,
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: const Text('Next'),
              style: ElevatedButton.styleFrom(
                backgroundColor: _saffron,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Verse card ───────────────────────────────────────────────────────────────

class _VerseCard extends StatefulWidget {
  final _Verse verse;
  const _VerseCard({required this.verse});

  @override
  State<_VerseCard> createState() => _VerseCardState();
}

class _VerseCardState extends State<_VerseCard> {
  static const _saffron = Color(0xFFC75A1A);
  static const _dark = Color(0xFF1A1410);
  static const _mid = Color(0xFF8B7D73);
  static const _gold = Color(0xFFD4A017);

  bool _showTranslations = true;
  bool _showNarrations = false;
  int _selectedTranslation = 0;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
              color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 3))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          if (widget.verse.sanskrit != null) _buildSanskrit(),
          if (widget.verse.transliteration != null) _buildTransliteration(),
          if (widget.verse.translations.isNotEmpty) _buildTranslations(),
          if (widget.verse.narrations.isNotEmpty) _buildNarrations(),
          const SizedBox(height: 14),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 12, 0),
      child: Row(
        children: [
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _saffron.withAlpha(25),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              'Verse ${widget.verse.verseNumber}',
              style: const TextStyle(
                  color: _saffron,
                  fontSize: 12,
                  fontWeight: FontWeight.bold),
            ),
          ),
          const Spacer(),
          if (widget.verse.translations.isNotEmpty)
            _iconToggle(
              Icons.translate_rounded,
              _showTranslations,
              () => setState(() => _showTranslations = !_showTranslations),
            ),
          if (widget.verse.narrations.isNotEmpty) ...[
            const SizedBox(width: 4),
            _iconToggle(
              Icons.comment_rounded,
              _showNarrations,
              () => setState(() => _showNarrations = !_showNarrations),
            ),
          ],
          const SizedBox(width: 4),
          GestureDetector(
            onTap: _copyVerse,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: const Icon(Icons.copy_rounded, color: _mid, size: 18),
            ),
          ),
        ],
      ),
    );
  }

  Widget _iconToggle(IconData icon, bool active, VoidCallback onTap) {
    return IconButton(
      icon: Icon(icon, color: active ? _saffron : _mid, size: 20),
      onPressed: onTap,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
    );
  }

  Widget _buildSanskrit() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _saffron.withAlpha(10),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _gold.withAlpha(60)),
      ),
      child: Text(
        widget.verse.sanskrit!,
        style: const TextStyle(
          fontFamily: 'NotoSansDevanagari',
          fontSize: 18,
          color: _dark,
          height: 1.9,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildTransliteration() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      child: Text(
        widget.verse.transliteration!,
        style: const TextStyle(
          fontStyle: FontStyle.italic,
          fontSize: 14,
          color: _mid,
          height: 1.6,
        ),
      ),
    );
  }

  Widget _buildTranslations() {
    if (!_showTranslations) return const SizedBox.shrink();

    final translations = widget.verse.translations;
    final selected = _selectedTranslation.clamp(0, translations.length - 1);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (translations.length > 1) ...[
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: List.generate(translations.length, (i) {
                  final sel = i == selected;
                  return GestureDetector(
                    onTap: () =>
                        setState(() => _selectedTranslation = i),
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: sel
                            ? _saffron
                            : _saffron.withAlpha(20),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        translations[i].translatorName.split(' ').last,
                        style: TextStyle(
                          color: sel ? Colors.white : _saffron,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 8),
          ],
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F4F0),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (translations.length == 1) ...[
                  Text(
                    translations[selected].translatorName,
                    style: const TextStyle(
                        color: _saffron,
                        fontSize: 11,
                        fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                ],
                Text(
                  translations[selected].meaning,
                  style: const TextStyle(
                      fontSize: 15, color: _dark, height: 1.65),
                ),
                if (translations[selected].purport != null &&
                    translations[selected].purport!.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  const Divider(height: 1),
                  const SizedBox(height: 10),
                  const Text('Purport',
                      style: TextStyle(
                          color: _mid,
                          fontSize: 11,
                          fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Text(
                    translations[selected].purport!,
                    style: const TextStyle(
                        fontSize: 13, color: _dark, height: 1.65),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNarrations() {
    if (!_showNarrations) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Narrations',
              style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: _dark)),
          const SizedBox(height: 8),
          ...widget.verse.narrations
              .map((n) => _NarrationTile(narration: n)),
        ],
      ),
    );
  }

  void _copyVerse() {
    final buf = StringBuffer();
    if (widget.verse.sanskrit != null) buf.writeln(widget.verse.sanskrit);
    if (widget.verse.transliteration != null) {
      buf.writeln(widget.verse.transliteration);
    }
    if (widget.verse.translations.isNotEmpty) {
      buf.writeln(widget.verse.translations.first.meaning);
    }
    Clipboard.setData(ClipboardData(text: buf.toString().trim()));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Verse copied to clipboard'),
        backgroundColor: _saffron,
      ),
    );
  }
}

// ─── Narration tile ───────────────────────────────────────────────────────────

class _NarrationTile extends StatefulWidget {
  final _Narration narration;
  const _NarrationTile({required this.narration});

  @override
  State<_NarrationTile> createState() => _NarrationTileState();
}

class _NarrationTileState extends State<_NarrationTile> {
  bool _expanded = false;

  static const _dark = Color(0xFF1A1410);
  static const _saffron = Color(0xFFC75A1A);

  @override
  Widget build(BuildContext context) {
    final isLong = widget.narration.text.length > 200;
    final display = !_expanded && isLong
        ? '${widget.narration.text.substring(0, 200)}…'
        : widget.narration.text;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4F0),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🧘', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  widget.narration.saintName,
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: _dark),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(display,
              style:
                  const TextStyle(fontSize: 13, color: _dark, height: 1.6)),
          if (isLong) ...[
            const SizedBox(height: 6),
            GestureDetector(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Text(
                _expanded ? 'Show less' : 'Read more',
                style: const TextStyle(
                    color: _saffron,
                    fontSize: 12,
                    fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
