import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import '../providers/verse_provider.dart';

class VerseDetailScreen extends ConsumerStatefulWidget {
  final String verseId;
  const VerseDetailScreen({super.key, required this.verseId});

  @override
  ConsumerState<VerseDetailScreen> createState() => _VerseDetailScreenState();
}

class _VerseDetailScreenState extends ConsumerState<VerseDetailScreen> {
  static const _saffron = Color(0xFFC75A1A);
  bool _isFavorited = false;
  bool _favoriteLoading = false;

  Future<void> _toggleFavorite(Map<String, dynamic>? verseData) async {
    if (_favoriteLoading) return;
    setState(() => _favoriteLoading = true);
    try {
      // TODO: call favorites API — wire when favorites provider is ready
      setState(() => _isFavorited = !_isFavorited);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isFavorited ? 'Added to favourites' : 'Removed from favourites'),
          duration: const Duration(seconds: 1),
          backgroundColor: _saffron,
        ),
      );
    } finally {
      setState(() => _favoriteLoading = false);
    }
  }

  Future<void> _shareVerse(dynamic verseData) async {
    final ref = '${verseData.bookTitle} ${verseData.chapterNumber}:${verseData.verseNumber}';
    final sanskrit = verseData.sanskrit as String? ?? '';
    final meaning = verseData.translation as String? ?? verseData.meaning as String? ?? '';

    final text = '🙏 $ref\n\n$sanskrit\n\n$meaning\n\nShared via HariHariBol';
    await Share.share(text, subject: 'Verse: $ref');
  }

  @override
  Widget build(BuildContext context) {
    final verse = ref.watch(verseDetailProvider(widget.verseId));

    return Scaffold(
      backgroundColor: const Color(0xFFFBF7EF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1A1410)),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          verse.maybeWhen(
            data: (v) => _favoriteLoading
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: _saffron)),
                  )
                : IconButton(
                    icon: Icon(
                      _isFavorited ? Icons.favorite : Icons.favorite_border,
                      color: _saffron,
                    ),
                    onPressed: () => _toggleFavorite(null),
                  ),
            orElse: () => IconButton(
              icon: const Icon(Icons.favorite_border, color: _saffron),
              onPressed: null,
            ),
          ),
          verse.maybeWhen(
            data: (v) => IconButton(
              icon: const Icon(Icons.share, color: Color(0xFF1A1410)),
              onPressed: () => _shareVerse(v),
            ),
            orElse: () => IconButton(
              icon: const Icon(Icons.share, color: Color(0xFF1A1410)),
              onPressed: null,
            ),
          ),
        ],
      ),
      body: verse.when(
        data: (verseData) => SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Reference chip
                GestureDetector(
                  onLongPress: () {
                    final ref = '${verseData.bookTitle} ${verseData.chapterNumber}:${verseData.verseNumber}';
                    Clipboard.setData(ClipboardData(text: ref));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Reference copied'), duration: Duration(seconds: 1)),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${verseData.bookTitle} ${verseData.chapterNumber}:${verseData.verseNumber}',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: _saffron,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                if (verseData.sanskrit.isNotEmpty) ...[
                  Text('Sanskrit', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold, color: const Color(0xFF1A1410))),
                  const SizedBox(height: 12),
                  _textCard(context, verseData.sanskrit, selectable: true),
                  const SizedBox(height: 24),
                ],

                if (verseData.transliteration != null) ...[
                  Text('Transliteration', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold, color: const Color(0xFF1A1410))),
                  const SizedBox(height: 12),
                  _textCard(context, verseData.transliteration!, italic: true, selectable: true),
                  const SizedBox(height: 24),
                ],

                if (verseData.translation != null) ...[
                  Text('Meaning', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold, color: const Color(0xFF1A1410))),
                  const SizedBox(height: 12),
                  _textCard(context, verseData.translation!, selectable: true),
                  const SizedBox(height: 24),
                ],
              ],
            ),
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(_saffron))),
        error: (err, stack) => Center(child: Text('Failed to load verse: $err', style: const TextStyle(color: Colors.red))),
      ),
    );
  }

  Widget _textCard(BuildContext context, String text, {bool italic = false, bool selectable = false}) {
    final style = Theme.of(context).textTheme.bodyMedium?.copyWith(
          fontStyle: italic ? FontStyle.italic : FontStyle.normal,
          color: const Color(0xFF1A1410),
          height: 1.7,
        );
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: selectable ? SelectableText(text, style: style) : Text(text, style: style),
    );
  }
}
