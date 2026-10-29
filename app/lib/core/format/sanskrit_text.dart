/// A verse's Devanagari as it is printed, from the text as it is stored.
///
/// The imported verses mark their ends with the keyboard's `|` and `||५-१||`,
/// which reads as stray bars on a page of Sanskrit. Printed, they are the danda
/// `।` and the double danda `॥` with the verse's number between two of them,
/// set apart by a space that must not break: a line that wrapped would
/// otherwise start with a lone `।`.
///
/// Display only — what is stored, copied into a chat or shared stays as it is.
String tidySanskrit(String text) {
  const noBreak = ' ';
  return text
      .replaceAll(RegExp(r'\|[ \t]*\|'), '॥')
      .replaceAll('|', '।')
      .replaceAll(RegExp(r'।[ \t]*।'), '॥')
      // A space before a danda stays, but is glued to the word it follows.
      .replaceAllMapped(RegExp(r'[ \t]+([।॥])'), (m) => '$noBreak${m[1]}')
      // `॥५-१॥` → `॥ ५-१ ॥`
      .replaceAllMapped(
        RegExp(r'॥[ \t ]*([०-९0-9][०-९0-9.\-–]*)[ \t ]*॥'),
        (m) => '॥$noBreak${m[1]}$noBreak॥',
      );
}

// "…उवाच" with or without its danda: Arjuna uvāca, śrī-bhagavān uvāca, …
final RegExp _speakerLine = RegExp(r'वाच[ \t ]*[।॥]?[ \t]*$');

/// A verse that opens by saying who speaks ("अर्जुन उवाच |"), split into that
/// line and the verse itself. [speaker] is null when the first line is part of
/// the verse, and also when the speaker is all there is.
({String? speaker, String verse}) splitSpeaker(String text) {
  final at = text.indexOf('\n');
  if (at < 0) return (speaker: null, verse: text);
  final first = text.substring(0, at).trim();
  final rest = text.substring(at + 1).trim();
  if (rest.isEmpty || !_speakerLine.hasMatch(first)) return (speaker: null, verse: text);
  return (speaker: first, verse: rest);
}
