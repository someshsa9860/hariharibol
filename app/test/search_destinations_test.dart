import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/navigation/app_routes.dart';
import 'package:hariharibol/core/search/search_destinations.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/l10n/generated/app_localizations_en.dart';

void main() {
  final AppLocalizations text = AppLocalizationsEn();

  test('"sakha ai" finds Ask Sakha', () {
    final found = matchDestinations('sakha ai', text);
    expect(found.map((d) => d.route), contains(AppRoutes.chat));
  });

  test('a partial word finds the page it starts', () {
    final found = matchDestinations('cal', text);
    expect(found.map((d) => d.route), contains(AppRoutes.calendar));
  });

  test('a blank query matches nothing', () {
    expect(matchDestinations('   ', text), isEmpty);
  });

  test('every destination route is an AppRoutes value and has a title', () {
    for (final destination in searchDestinations) {
      expect(destination.title(text), isNotEmpty);
      expect(destination.route.startsWith('/'), isTrue);
    }
  });

  test('normalise drops punctuation and case', () {
    expect(normaliseSearchText(' Sakha-AI! '), 'sakha ai');
  });
}
