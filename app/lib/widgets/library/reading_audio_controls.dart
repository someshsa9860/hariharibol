import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/reading_audio_provider.dart';
import '../../services/audio/reading_item.dart';
import '../../services/audio/reading_playback_controller.dart';

String readingSectionLabel(AppLocalizations text, ReadingSection section) => switch (section) {
      ReadingSection.verse => text.readingSectionVerse,
      ReadingSection.meaning => text.readingSectionMeaning,
      ReadingSection.purport => text.readingSectionPurport,
    };

/// The "read aloud" button at the top of the reading page. Idle: starts the
/// chapter (or offers to carry on from where the reader stopped). Playing: the
/// bar below takes over, so this one shows it is on.
class ReadingAudioAction extends ConsumerWidget {
  const ReadingAudioAction({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final audio = ref.watch(readingAudioProvider);
    final state = ref.watch(readingStateProvider).value ?? const ReadingState();
    final controller = audio.controller;

    if (state.isActive) {
      return IconButton(
        icon: const Icon(Icons.stop_circle_outlined),
        tooltip: text.readingAudioStop,
        onPressed: audio.stop,
      );
    }
    if (controller.items.isEmpty || !controller.items.any((i) => i.hasAnything)) return const SizedBox.shrink();

    final resumeAt = controller.resumeIndex();
    final channel = text.readingAudioChannel;

    // Nothing to resume: one tap starts. Something to resume: ask which.
    if (resumeAt == null || resumeAt == 0) {
      return IconButton(
        icon: const Icon(Icons.play_circle_outline_rounded),
        tooltip: text.readingAudioPlayAll,
        onPressed: () => audio.playAll(channelName: channel),
      );
    }

    final number = controller.items[resumeAt].verse.verseNumber ?? resumeAt + 1;
    return PopupMenuButton<int>(
      icon: const Icon(Icons.play_circle_outline_rounded),
      tooltip: text.readingAudioPlayAll,
      onSelected: (from) => audio.playAll(from: from, channelName: channel),
      itemBuilder: (_) => [
        PopupMenuItem(value: resumeAt, child: Text(text.readingAudioResumeFrom(number))),
        PopupMenuItem(value: 0, child: Text(text.readingAudioFromStart)),
      ],
    );
  }
}

/// Previous / pause / next / stop and what is being heard, shown while reading
/// aloud. Sits at the bottom so the verse stays in view.
class ReadingPlayerBar extends ConsumerWidget {
  const ReadingPlayerBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(readingStateProvider).value ?? const ReadingState();
    if (!state.isActive) return const SizedBox.shrink();

    final text = AppLocalizations.of(context);
    final audio = ref.read(readingAudioProvider);
    final index = state.index ?? 0;
    final items = audio.controller.items;
    final verseNumber = index < items.length ? (items[index].verse.verseNumber ?? index + 1) : index + 1;
    final section = state.section;
    final isPaused = state.status == ReadingStatus.paused;

    return Material(
      color: context.colors.surfaceContainerHighest,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
          child: Row(
            children: [
              Expanded(
                child: Semantics(
                  liveRegion: true,
                  child: Text(
                    state.status == ReadingStatus.loading || section == null
                        ? text.readingAudioLoading
                        : text.readingAudioNowPlaying(readingSectionLabel(text, section), verseNumber),
                    style: context.texts.labelLarge,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.skip_previous_rounded),
                tooltip: text.readingAudioPrevious,
                onPressed: audio.controller.previous,
              ),
              IconButton(
                icon: Icon(isPaused ? Icons.play_arrow_rounded : Icons.pause_rounded),
                tooltip: isPaused ? text.readingAudioResume : text.readingAudioPause,
                onPressed: audio.togglePause,
              ),
              IconButton(
                icon: const Icon(Icons.skip_next_rounded),
                tooltip: text.readingAudioNext,
                onPressed: audio.controller.next,
              ),
              IconButton(
                icon: const Icon(Icons.stop_rounded),
                tooltip: text.readingAudioStop,
                onPressed: audio.stop,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
