/// `languages=mr,en` for a call that names the reader's languages. The server
/// takes up to three codes of two or three letters and answers 400 to anything
/// else, so a code that is not one is left out here rather than costing the
/// reader their screen.
Map<String, dynamic> languagesQuery(List<String>? languages) {
  final codes = (languages ?? const <String>[])
      .where((code) => RegExp(r'^[a-zA-Z]{2,3}$').hasMatch(code))
      .take(3)
      .toList();
  return codes.isEmpty ? const {} : {'languages': codes.join(',')};
}
