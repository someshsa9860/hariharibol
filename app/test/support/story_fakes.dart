import 'package:hariharibol/models/reading_mode.dart';
import 'package:hariharibol/providers/reading_prefs_provider.dart';

// The reading layout's settings held in memory: a write started inside a widget
// test's fake clock never finishes, and with no store open a read throws. A test
// that draws the chapter reader or the reading settings sheet overrides these.

class StoryModeInMemory extends ReadingModeNotifier {
  StoryModeInMemory([this.start = ReadingMode.verses]);

  final ReadingMode start;

  @override
  ReadingMode build() => start;

  @override
  Future<void> set(ReadingMode mode) async => state = mode;
}

class StoryPartInMemory extends StoryPartNotifier {
  StoryPartInMemory([this.start = StoryPart.translation]);

  final StoryPart start;

  @override
  StoryPart build() => start;

  @override
  Future<void> set(StoryPart part) async => state = part;
}

class StoryNumbersInMemory extends StoryNumbersNotifier {
  @override
  bool build() => true;

  @override
  Future<void> set(bool shown) async => state = shown;
}

final storyOverrides = [
  readingModeProvider.overrideWith(StoryModeInMemory.new),
  storyPartProvider.overrideWith(StoryPartInMemory.new),
  storyNumbersProvider.overrideWith(StoryNumbersInMemory.new),
];
