import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The dashboard's tabs sit in a nested navigator beneath the floating bar, so
/// a sheet opened on the nearest navigator rises *under* the bar and its
/// buttons cannot be tapped. Every sheet goes on the root navigator.
void main() {
  test('every bottom sheet is shown on the root navigator', () {
    final missing = <String>[];
    for (final file in Directory('lib').listSync(recursive: true).whereType<File>()) {
      if (!file.path.endsWith('.dart')) continue;
      final lines = file.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        if (!lines[i].contains('showModalBottomSheet') || lines[i].trimLeft().startsWith('//')) continue;
        final call = lines.skip(i).take(8).join('\n');
        if (!call.contains('useRootNavigator: true')) missing.add('${file.path}:${i + 1}');
      }
    }
    expect(missing, isEmpty, reason: 'add useRootNavigator: true to these sheets');
  });
}
