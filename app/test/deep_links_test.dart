// What a link names, and where it goes. The rules are pure (`DeepLinks.parse`, `DeepLinks.routeFor`), so no
// plugin, platform channel or network is needed.
//
//   tool/flutter.sh test test/deep_links_test.dart

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/navigation/app_routes.dart';
import 'package:hariharibol/models/share.dart';
import 'package:hariharibol/services/deep_links.dart';

void main() {
  group('parse', () {
    test('reads the four https paths', () {
      for (final segment in ['shloka', 'mantra', 'divya', 'satsang']) {
        final parsed = DeepLinks.parse(Uri.parse('https://hariharibol.com/$segment/ABCD2345KK'));
        expect(parsed, isNotNull, reason: segment);
        expect(parsed!.segment, segment);
        expect(parsed.code, 'ABCD2345KK');
      }
    });

    test('reads the app scheme the same way', () {
      final parsed = DeepLinks.parse(Uri.parse('hariharibol://mantra/ABCD2345KK'));
      expect(parsed?.segment, 'mantra');
      expect(parsed?.code, 'ABCD2345KK');
    });

    test('ignores attribution parameters and trailing slashes', () {
      final parsed = DeepLinks.parse(Uri.parse('https://hariharibol.com/shloka/ABCD2345KK/?utm_source=wa&next=http://evil.test'));
      expect(parsed?.code, 'ABCD2345KK');
    });

    test('refuses other hosts, unknown paths and codes that cannot be codes', () {
      expect(DeepLinks.parse(Uri.parse('https://evil.test/shloka/ABCD2345KK')), isNull);
      expect(DeepLinks.parse(Uri.parse('https://hariharibol.com.evil.test/shloka/ABCD2345KK')), isNull);
      expect(DeepLinks.parse(Uri.parse('https://hariharibol.com/share/ABCD2345KK')), isNull);
      expect(DeepLinks.parse(Uri.parse('https://hariharibol.com/shloka/../etc')), isNull);
      expect(DeepLinks.parse(Uri.parse('https://hariharibol.com/shloka/AB')), isNull);
      expect(DeepLinks.parse(Uri.parse('https://hariharibol.com/shloka')), isNull);
      expect(DeepLinks.parse(Uri.parse('mailto:a@b.test')), isNull);
    });
  });

  group('routeFor', () {
    test('a verse opens its chapter at the verse', () {
      final route = DeepLinks.routeFor(const ResolvedShare(
        kind: 'SHLOKA',
        place: {'bookSlug': 'bhagavad-gita', 'chapterNumber': 2, 'cantoNumber': null, 'verseNumber': 47},
      ));
      expect(route, AppRoutes.chapterPath('bhagavad-gita', 2, verse: 47));
    });

    test('a verse in a book with cantos keeps the canto', () {
      final route = DeepLinks.routeFor(const ResolvedShare(
        kind: 'SHLOKA',
        place: {'bookSlug': 'srimad-bhagavatam', 'chapterNumber': 3, 'cantoNumber': 1, 'verseNumber': 28},
      ));
      expect(route, AppRoutes.chapterPath('srimad-bhagavatam', 3, canto: 1, verse: 28));
    });

    test('a short work opens its book page', () {
      final route = DeepLinks.routeFor(const ResolvedShare(kind: 'SHLOKA', place: {'bookSlug': 'isopanishad'}));
      expect(route, AppRoutes.bookPath('isopanishad'));
    });

    test('a mantra opens its page, and a reel opens that reel — not the feed', () {
      expect(DeepLinks.routeFor(const ResolvedShare(kind: 'MANTRA', place: {'slug': 'om-namah-shivaya'})), AppRoutes.mantraPath('om-namah-shivaya'));
      expect(DeepLinks.routeFor(const ResolvedShare(kind: 'REEL', place: {'reelId': 'r1'})), AppRoutes.reelPath('r1'));
    });

    test('an incomplete place opens nothing', () {
      expect(DeepLinks.routeFor(const ResolvedShare(kind: 'REEL', place: {})), isNull);
      expect(DeepLinks.routeFor(const ResolvedShare(kind: 'MANTRA', place: {})), isNull);
      expect(DeepLinks.routeFor(const ResolvedShare(kind: 'SHLOKA', place: {})), isNull);
    });
  });
}
