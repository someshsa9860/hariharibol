import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/format/chant_format.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/chant_mala_player.dart';

/// The mantra's mala recording: a play button and a bar that can be dragged to
/// any point in it. While it plays the counter counts with it — that is the
/// screen's job, listening to [ChantMalaPlayer.chantsCompleted]; this card only
/// plays and shows where the recording is.
class ChantAlongCard extends StatefulWidget {
  const ChantAlongCard({super.key, required this.player});

  final ChantMalaPlayer player;

  @override
  State<ChantAlongCard> createState() => _ChantAlongCardState();
}

class _ChantAlongCardState extends State<ChantAlongCard> {
  /// Where the thumb is while a finger holds it, in milliseconds; null when it
  /// follows playback. The recording keeps playing under a drag, and the seek
  /// happens once, on release.
  double? _dragMs;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Card(
      // The play button and the bar are controls: each is reached on its own,
      // not read as one block of the card's text.
      semanticContainer: false,
      child: Padding(
        padding: AppSpacing.card,
        child: ValueListenableBuilder<ChantMalaPlayerState>(
          valueListenable: widget.player.state,
          builder: (context, state, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.headphones_rounded, color: context.colors.onSurfaceVariant),
                  const SizedBox(width: AppSpacing.md),
                  Text(text.chantAlongTitle, style: context.texts.titleSmall),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              switch (state.phase) {
                ChantMalaPhase.loading => _Message(text.chantAlongLoading, busy: true),
                ChantMalaPhase.failed => _Failed(onRetry: widget.player.load),
                ChantMalaPhase.ready => _controls(context, text, state),
              },
              const SizedBox(height: AppSpacing.sm),
              Text(
                text.chantAlongCaption,
                style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _controls(BuildContext context, AppLocalizations text, ChantMalaPlayerState state) {
    final length = state.duration.inMilliseconds.toDouble();
    final seekable = length > 0;
    final shown = (_dragMs ?? state.position.inMilliseconds.toDouble()).clamp(
      0.0,
      seekable ? length : 1.0,
    );
    final labelStyle = context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);

    return Row(
      children: [
        IconButton.filled(
          iconSize: AppSizes.iconLg,
          tooltip: state.playing ? text.chantAlongPause : text.chantAlongPlay,
          icon: Icon(state.playing ? Icons.pause_rounded : Icons.play_arrow_rounded),
          onPressed: widget.player.toggle,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            children: [
              // One stop for a screen reader: the name, the position and the
              // adjust actions together, rather than a label and a bare slider.
              MergeSemantics(
                child: Semantics(
                  label: text.chantAlongPosition,
                  child: Slider(
                    value: shown,
                    max: seekable ? length : 1.0,
                    semanticFormatterCallback: (value) =>
                        formatClock(Duration(milliseconds: value.round())),
                    onChangeStart: seekable ? (value) => setState(() => _dragMs = value) : null,
                    onChanged: seekable ? (value) => setState(() => _dragMs = value) : null,
                    onChangeEnd: (value) {
                      setState(() => _dragMs = null);
                      unawaited(widget.player.seek(Duration(milliseconds: value.round())));
                    },
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(formatClock(Duration(milliseconds: shown.round())), style: labelStyle),
                    Text(formatClock(state.duration), style: labelStyle),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Message extends StatelessWidget {
  const _Message(this.message, {this.busy = false});

  final String message;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (busy) ...[const LinearProgressIndicator(), const SizedBox(height: AppSpacing.sm)],
        Text(message, style: context.texts.bodyMedium),
      ],
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Row(
      children: [
        Expanded(child: Text(text.chantAlongLoadFailed, style: context.texts.bodyMedium)),
        TextButton(onPressed: onRetry, child: Text(text.actionRetry)),
      ],
    );
  }
}
