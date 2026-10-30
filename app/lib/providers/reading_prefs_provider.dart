import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/storage_keys.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/reading_themes.dart';
import '../models/reading_mode.dart';
import '../models/verse_part.dart';
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

/// The reading page's look: the app's own theme, or one of the reading papers.
/// Stored on the device, like the font size above.
class ReadingLookNotifier extends Notifier<ReadingLook> {
  @override
  ReadingLook build() {
    final stored = LocalStore.instance.read<String>(BoxKeys.readingLook);
    return ReadingLook.values.firstWhere(
      (look) => look.name == stored,
      orElse: () => ReadingLook.matchApp,
    );
  }

  Future<void> set(ReadingLook look) async {
    state = look;
    await LocalStore.instance.write(BoxKeys.readingLook, look.name);
  }
}

final readingLookProvider = NotifierProvider<ReadingLookNotifier, ReadingLook>(ReadingLookNotifier.new);

/// Whether a verse's "Word meanings" is open. Closed until somebody opens one,
/// and from then on open in every verse until somebody closes one — stored on
/// the device, like the font size above.
class WordMeaningsOpenNotifier extends Notifier<bool> {
  @override
  bool build() => LocalStore.instance.read<bool>(BoxKeys.wordMeaningsOpen) ?? false;

  Future<void> set(bool open) async {
    state = open;
    await LocalStore.instance.write(BoxKeys.wordMeaningsOpen, open);
  }
}

final wordMeaningsOpenProvider = NotifierProvider<WordMeaningsOpenNotifier, bool>(WordMeaningsOpenNotifier.new);

/// The parts of a verse the reader has chosen to hide. Nothing is hidden until
/// somebody ticks a box, and the choice holds for every verse in every book —
/// stored on the device, like the font size above.
class HiddenVersePartsNotifier extends Notifier<Set<VersePart>> {
  @override
  Set<VersePart> build() => {
        for (final part in VersePart.values)
          if (LocalStore.instance.read<bool>(BoxKeys.readingHiddenPart(part.name)) ?? false) part,
      };

  Future<void> set(VersePart part, {required bool hidden}) async {
    state = hidden ? {...state, part} : ({...state}..remove(part));
    await LocalStore.instance.write(BoxKeys.readingHiddenPart(part.name), hidden);
  }
}

final hiddenVersePartsProvider =
    NotifierProvider<HiddenVersePartsNotifier, Set<VersePart>>(HiddenVersePartsNotifier.new);

/// Whether a chapter is read verse by verse or as a story. Stored on the device,
/// like the font size above.
class ReadingModeNotifier extends Notifier<ReadingMode> {
  @override
  ReadingMode build() =>
      LocalStore.instance.read<String>(BoxKeys.readingMode) == ReadingMode.story.name
          ? ReadingMode.story
          : ReadingMode.verses;

  Future<void> set(ReadingMode mode) async {
    state = mode;
    await LocalStore.instance.write(BoxKeys.readingMode, mode.name);
  }
}

final readingModeProvider = NotifierProvider<ReadingModeNotifier, ReadingMode>(ReadingModeNotifier.new);

/// The part of a verse story mode shows. The meaning until somebody picks
/// another: it is what reads like a story in every language.
class StoryPartNotifier extends Notifier<StoryPart> {
  @override
  StoryPart build() {
    final stored = LocalStore.instance.read<String>(BoxKeys.storyPart);
    return StoryPart.values.firstWhere((part) => part.name == stored, orElse: () => StoryPart.translation);
  }

  Future<void> set(StoryPart part) async {
    state = part;
    await LocalStore.instance.write(BoxKeys.storyPart, part.name);
  }
}

final storyPartProvider = NotifierProvider<StoryPartNotifier, StoryPart>(StoryPartNotifier.new);

/// Whether story mode puts each verse's number in front of it. On by default.
class StoryNumbersNotifier extends Notifier<bool> {
  @override
  bool build() => LocalStore.instance.read<bool>(BoxKeys.storyNumbers) ?? true;

  Future<void> set(bool shown) async {
    state = shown;
    await LocalStore.instance.write(BoxKeys.storyNumbers, shown);
  }
}

final storyNumbersProvider = NotifierProvider<StoryNumbersNotifier, bool>(StoryNumbersNotifier.new);
