import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/verse_provider.dart';

class VerseDetailScreen extends ConsumerWidget {
  final String verseId;

  const VerseDetailScreen({
    super.key,
    required this.verseId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verse = ref.watch(verseDetailProvider(verseId));

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
          IconButton(
            icon: const Icon(Icons.favorite_border, color: Color(0xFFC75A1A)),
            onPressed: () {
              // TODO: Add to favorites
            },
          ),
          IconButton(
            icon: const Icon(Icons.share, color: Color(0xFF1A1410)),
            onPressed: () {
              // TODO: Share verse
            },
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
                // Reference
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${verseData.bookTitle} ${verseData.chapterNumber}:${verseData.verseNumber}',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: const Color(0xFFC75A1A),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                // Sanskrit text
                if (verseData.sanskrit.isNotEmpty) ...[
                  Text(
                    'Sanskrit',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF1A1410),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      verseData.sanskrit,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        height: 1.8,
                        color: const Color(0xFF1A1410),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
                // Transliteration
                if (verseData.transliteration != null) ...[
                  Text(
                    'Transliteration',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF1A1410),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      verseData.transliteration!,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontStyle: FontStyle.italic,
                        color: const Color(0xFF1A1410),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
                // Translation/Meaning
                if (verseData.translation != null) ...[
                  Text(
                    'Meaning',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF1A1410),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      verseData.translation ?? 'Translation not available',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF1A1410),
                        height: 1.6,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ],
            ),
          ),
        ),
        loading: () => const Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(
              Color(0xFFC75A1A),
            ),
          ),
        ),
        error: (err, stack) => Center(
          child: Text(
            'Failed to load verse: $err',
            style: const TextStyle(color: Colors.red),
          ),
        ),
      ),
    );
  }
}