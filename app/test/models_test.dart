import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/models/sadhana.dart';
import 'package:hariharibol/models/search_result.dart';
import 'package:hariharibol/models/verse.dart';

void main() {
  group('SadhanaDay', () {
    test('reports no progress when no target is set', () {
      const day = SadhanaDay(roundTarget: 0, roundsCompleted: 4, tasksTotal: 0, tasksDone: 0);
      expect(day.roundProgress, 0);
      expect(day.roundTargetMet, isFalse);
    });

    test('clamps progress once the target is passed', () {
      const day = SadhanaDay(roundTarget: 16, roundsCompleted: 20, tasksTotal: 3, tasksDone: 1);
      expect(day.roundProgress, 1);
      expect(day.roundTargetMet, isTrue);
      expect(day.taskProgress, closeTo(0.333, 0.001));
    });
  });

  group('Verse.reference', () {
    test('numbers a Gita verse without a canto', () {
      final verse = Verse.fromJson({
        'id': 'v1',
        'verseId': '1.2.13',
        'bookNumber': 1,
        'chapterNumber': 2,
        'verseNumber': 13,
        'book': {'id': 'b1', 'slug': 'bhagavad-gita', 'title': 'Bhagavad Gita', 'bookNumber': 1},
      });
      expect(verse.reference, 'Bhagavad Gita 2.13');
    });

    test('keeps a Bhagavatam range together', () {
      final verse = Verse.fromJson({
        'id': 'v2',
        'verseId': '2.10.1.5-7',
        'bookNumber': 2,
        'cantoNumber': 10,
        'chapterNumber': 1,
        'verseNumber': 5,
        'verseNumberEnd': 7,
        'book': {'id': 'b2', 'slug': 'srimad-bhagavatam', 'title': 'Srimad Bhagavatam', 'bookNumber': 2},
      });
      expect(verse.reference, 'Srimad Bhagavatam 10.1.5-7');
    });
  });

  group('SearchOverview.fromJson', () {
    test('reads each kind and its hasMore flag independently', () {
      final overview = SearchOverview.fromJson({
        'query': 'krishna',
        'verses': [],
        'verseHasMore': false,
        'mantras': [
          {'id': 'm1', 'slug': 'hare-krishna', 'name': 'Hare Krishna', 'text': 'Hare Krishna'},
        ],
        'mantraHasMore': true,
        'books': [],
        'bookHasMore': false,
      });

      expect(overview.query, 'krishna');
      expect(overview.verses, isEmpty);
      expect(overview.mantras, hasLength(1));
      expect(overview.mantraHasMore, isTrue);
      expect(overview.bookHasMore, isFalse);
      expect(overview.isEmpty, isFalse);
    });

    test('is empty only when all three kinds are', () {
      final overview = SearchOverview.fromJson({'query': 'xyzzy'});
      expect(overview.isEmpty, isTrue);
    });
  });
}
