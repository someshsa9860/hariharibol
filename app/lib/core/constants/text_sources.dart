/// Where the library's texts were taken from, named on Settings → Sources &
/// disclaimer. The addresses are shown as text that can be copied; nothing
/// opens a browser. What each source gave is copy and lives in the ARB files
/// (`sourcesGita`, `sourcesBhagavatam`, `sourcesDnyaneshwari`).
///
/// The website lists the same sources on its `/sources` page
/// (`website/src/lib/config.ts`); a source added here is added there too.
abstract final class TextSources {
  static const String gita = 'github.com/vedicscriptures/bhagavad-gita';

  /// The Bhagavatam came from two places, split by canto.
  static const String bhagavatamEarly = 'srimad-bhagavatam.github.io';
  static const ({int from, int to}) bhagavatamEarlyCantos = (from: 1, to: 9);
  static const String bhagavatamLate = 'vedabase.io';
  static const ({int from, int to}) bhagavatamLateCantos = (from: 10, to: 12);

  static const String dnyaneshwari = 'mr.wikisource.org';
}
