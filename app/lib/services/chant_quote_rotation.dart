import 'dart:math' as math;

import '../core/constants/chant_quote_config.dart';

/// Which quote the chanting page shows for a count of chants. Pure, so a test
/// walks it without a screen.
///
/// The quote changes after every [ChantQuoteConfig.chantsPerQuote] chants. The
/// order is a shuffle fixed for the sitting (`seed`), so a sitting does not
/// start on the same quote as the last, nothing repeats before every quote has
/// been shown, and an undo that takes the count back below a multiple of 12
/// brings back the quote that was there.
abstract final class ChantQuoteRotation {
  /// How many quotes have been passed after [chants] chants: 0 up to 11, 1 from
  /// 12, and so on. Never negative.
  static int stepOf(int chants) => chants < 0 ? 0 : chants ~/ ChantQuoteConfig.chantsPerQuote;

  /// The positions 0…[length]-1 in the order they are shown for [seed].
  static List<int> order(int length, int seed) {
    final positions = List<int>.generate(length < 0 ? 0 : length, (i) => i);
    positions.shuffle(math.Random(seed));
    return positions;
  }

  /// The position in the list of quotes to show after [chants] chants, or null
  /// when there are no quotes.
  static int? indexFor({required List<int> order, required int chants}) {
    if (order.isEmpty) return null;
    return order[stepOf(chants) % order.length];
  }
}
