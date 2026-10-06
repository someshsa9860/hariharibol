import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/storage_keys.dart';
import '../core/theme/app_typography.dart';
import '../services/local_store.dart';

/// How large the reading screen sets its text.
///
/// Stored on the device, the same reasoning as [ThemeModeNotifier] —
/// somebody reading on a phone at arm's length and on a tablet up close wants
/// different answers, and the server has no way to know which is which.
class ReadingFontSizeNotifier extends Notifier<ReadingFontSize> {
  @override
  ReadingFontSize build() {
    return _parse(LocalStore.instance.read<String>(BoxKeys.readingFontSize));
  }

  Future<void> set(ReadingFontSize size) async {
    state = size;
    await LocalStore.instance.write(BoxKeys.readingFontSize, size.name);
  }

  static ReadingFontSize _parse(String? stored) => switch (stored) {
        'small' => ReadingFontSize.small,
        'large' => ReadingFontSize.large,
        'extraLarge' => ReadingFontSize.extraLarge,
        _ => ReadingFontSize.medium,
      };
}

final readingFontSizeProvider =
    NotifierProvider<ReadingFontSizeNotifier, ReadingFontSize>(ReadingFontSizeNotifier.new);
