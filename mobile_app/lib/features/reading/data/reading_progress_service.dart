import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/hive_storage.dart';

class ReadingProgress {
  final String bookId;
  final String bookTitle;
  final String? coverUrl;
  final int chapterNum;
  final String chapterTitle;

  const ReadingProgress({
    required this.bookId,
    required this.bookTitle,
    this.coverUrl,
    required this.chapterNum,
    required this.chapterTitle,
  });
}

class ReadingProgressNotifier extends Notifier<ReadingProgress?> {
  static const _kBookId = 'rp_book_id';
  static const _kBookTitle = 'rp_book_title';
  static const _kCoverUrl = 'rp_cover_url';
  static const _kChapterNum = 'rp_chapter_num';
  static const _kChapterTitle = 'rp_chapter_title';

  @override
  ReadingProgress? build() => _load();

  ReadingProgress? _load() {
    final bookId = HiveStorage.get(_kBookId) as String?;
    if (bookId == null || bookId.isEmpty) return null;
    return ReadingProgress(
      bookId: bookId,
      bookTitle: HiveStorage.get(_kBookTitle) as String? ?? '',
      coverUrl: _nonEmpty(HiveStorage.get(_kCoverUrl) as String?),
      chapterNum: HiveStorage.get(_kChapterNum) as int? ?? 1,
      chapterTitle: HiveStorage.get(_kChapterTitle) as String? ?? '',
    );
  }

  Future<void> save(ReadingProgress progress) async {
    await HiveStorage.put(_kBookId, progress.bookId);
    await HiveStorage.put(_kBookTitle, progress.bookTitle);
    await HiveStorage.put(_kCoverUrl, progress.coverUrl ?? '');
    await HiveStorage.put(_kChapterNum, progress.chapterNum);
    await HiveStorage.put(_kChapterTitle, progress.chapterTitle);
    state = progress;
  }

  Future<void> clear() async {
    await HiveStorage.delete(_kBookId);
    state = null;
  }

  static String? _nonEmpty(String? s) =>
      (s == null || s.isEmpty) ? null : s;
}

final readingProgressProvider =
    NotifierProvider<ReadingProgressNotifier, ReadingProgress?>(
        ReadingProgressNotifier.new);
