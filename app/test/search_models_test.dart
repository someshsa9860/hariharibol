import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/models/search_result.dart';
import 'package:hariharibol/models/verse.dart';
import 'package:hariharibol/widgets/search/highlighted_snippet.dart';

void main() {
  group('SearchRequest', () {
    test('is a value: the same words and book are the same search', () {
      expect(const SearchRequest('karma', book: 'bhagavad-gita'),
          const SearchRequest('karma', book: 'bhagavad-gita'));
      expect(const SearchRequest('karma'), isNot(const SearchRequest('karma', book: 'bhagavad-gita')));
      expect(const SearchRequest('karma').hashCode, const SearchRequest('karma').hashCode);
    });
  });

  group('SearchOverview.fromJson', () {
    test('reads the book the query named, the correction and the counts', () {
      final overview = SearchOverview.fromJson({
        'query': 'gita surrendr',
        'scope': {'slug': 'bhagavad-gita', 'title': 'Bhagavad Gita', 'fromQuery': true, 'text': 'surrendr'},
        'corrected': 'surrender',
        'verses': [],
        'verseTotal': 12,
        'mantraTotal': 0,
        'bookTotal': 1,
      });

      expect(overview.scope?.slug, 'bhagavad-gita');
      expect(overview.scope?.fromQuery, isTrue);
      expect(overview.scope?.text, 'surrendr');
      expect(overview.corrected, 'surrender');
      expect(overview.verseTotal, 12);
      expect(overview.bookTotal, 1);
    });

    test('has no scope or correction when the server sent none', () {
      final overview = SearchOverview.fromJson({'query': 'krishna'});
      expect(overview.scope, isNull);
      expect(overview.corrected, isNull);
      expect(overview.verseTotal, 0);
    });
  });

  group('Verse.searchMatch', () {
    Map<String, dynamic> verse(Map<String, dynamic> extra) => {
          'id': 'v1',
          'verseId': '1.2.47',
          'bookNumber': 1,
          'type': 'SHLOKA',
          ...extra,
        };

    test('is read when the search says where it found the words', () {
      final parsed = Verse.fromJson(verse({
        'searchMatch': {'field': 'purport', 'snippet': 'to [surrender] and duty'},
      }));
      expect(parsed.searchMatch?.field, 'purport');
      expect(parsed.searchMatch?.snippet, 'to [surrender] and duty');
    });

    test('is absent on an ordinary verse', () {
      expect(Verse.fromJson(verse({})).searchMatch, isNull);
    });
  });

  group('HighlightedSnippet.split', () {
    test('cuts a passage into plain and matched pieces, without the brackets', () {
      final pieces = HighlightedSnippet.split('…duty, but [fruits] of [action].');
      expect(pieces.map((p) => p.text).toList(), ['…duty, but ', 'fruits', ' of ', 'action', '.']);
      expect(pieces.map((p) => p.matched).toList(), [false, true, false, true, false]);
    });

    test('a passage with nothing marked is one plain piece', () {
      final pieces = HighlightedSnippet.split('nothing marked');
      expect(pieces, hasLength(1));
      expect(pieces.single.matched, isFalse);
    });
  });
}
