import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/chat_state.dart';
import 'chat_draft_image.dart';

/// The box a question is typed, spoken or illustrated in.
///
/// Left to right: add a picture, the text, and one button that is Stop while a
/// reply is being written, Stop-listening while the phone listens, Send once
/// there is something to send, and the microphone otherwise.
class ChatComposer extends StatelessWidget {
  const ChatComposer({
    super.key,
    required this.controller,
    required this.maxChars,
    required this.busy,
    required this.enabled,
    required this.listening,
    required this.draftImage,
    required this.onSend,
    required this.onStop,
    required this.onAttach,
    required this.onMic,
    required this.onRemoveImage,
    required this.onRetryImage,
  });

  final TextEditingController controller;
  final int maxChars;

  /// A reply is being written: the button stops it, and a new question waits.
  final bool busy;

  /// False when nothing can be sent (no credits): the box stays but is dim.
  final bool enabled;

  /// The phone is listening to the reader.
  final bool listening;
  final ChatDraftImage? draftImage;
  final ValueChanged<String> onSend;
  final VoidCallback onStop;
  final VoidCallback onAttach;
  final VoidCallback onMic;
  final VoidCallback onRemoveImage;
  final VoidCallback onRetryImage;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final image = draftImage;
    final idle = enabled && !busy;

    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedSize(
            duration: AppDurations.normal,
            curve: Curves.easeOutCubic,
            alignment: Alignment.bottomCenter,
            child: image == null
                ? const SizedBox(width: double.infinity)
                : ChatDraftImageStrip(image: image, onRemove: onRemoveImage, onRetry: onRetryImage),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.sm, AppSpacing.sm, AppSpacing.lg, AppSpacing.md),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  tooltip: text.chatAttach,
                  onPressed: idle && !listening ? onAttach : null,
                  icon: const Icon(Icons.add_photo_alternate_outlined),
                ),
                Expanded(
                  child: TextField(
                    controller: controller,
                    enabled: enabled,
                    minLines: 1,
                    maxLines: ChatConfig.composerMaxLines,
                    maxLength: maxChars,
                    keyboardType: TextInputType.multiline,
                    textInputAction: TextInputAction.newline,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText: listening ? text.chatListening : text.chatComposerHint,
                      border: _border(context.colors.surfaceContainerHighest),
                      enabledBorder: _border(context.colors.surfaceContainerHighest),
                      focusedBorder: _border(context.colors.primary, width: 1.5),
                    ),
                    buildCounter: (context, {required currentLength, required isFocused, required maxLength}) {
                      final limit = maxLength ?? maxChars;
                      if (currentLength < limit * ChatConfig.counterShowsAt) return null;
                      return Text(
                        text.chatCharacterCount(currentLength, limit),
                        style: context.texts.bodySmall,
                      );
                    },
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Padding(
                  // Lines up with the box, not with the counter beneath it.
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: ValueListenableBuilder<TextEditingValue>(
                    valueListenable: controller,
                    builder: (context, value, _) => _ActionButton(
                      busy: busy,
                      listening: listening,
                      enabled: enabled,
                      hasContent: value.text.trim().isNotEmpty || (image?.ready ?? false),
                      pictureReady: image?.ready ?? true,
                      onSend: () => onSend(value.text),
                      onStop: onStop,
                      onMic: onMic,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The box has a pill-like outline instead of the theme's square-ish one: it
  /// is the thing the reader touches most on this screen.
  OutlineInputBorder _border(Color color, {double width = 0}) => OutlineInputBorder(
        borderRadius: AppRadius.lgAll,
        borderSide: width == 0 ? BorderSide.none : BorderSide(color: color, width: width),
      );
}

/// Stop / stop listening / Send / microphone, swapping with a small pop.
class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.busy,
    required this.listening,
    required this.enabled,
    required this.hasContent,
    required this.pictureReady,
    required this.onSend,
    required this.onStop,
    required this.onMic,
  });

  final bool busy;
  final bool listening;
  final bool enabled;
  final bool hasContent;
  final bool pictureReady;
  final VoidCallback onSend;
  final VoidCallback onStop;
  final VoidCallback onMic;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    final Widget button;
    if (busy) {
      button = IconButton.filled(
        key: const ValueKey('stop'),
        tooltip: text.chatStop,
        onPressed: onStop,
        icon: const Icon(Icons.stop_rounded),
      );
    } else if (listening) {
      button = _ListeningButton(key: const ValueKey('listening'), onPressed: onMic);
    } else if (hasContent) {
      button = IconButton.filled(
        key: const ValueKey('send'),
        tooltip: text.chatSend,
        onPressed: enabled && pictureReady ? onSend : null,
        icon: const Icon(Icons.arrow_upward_rounded),
      );
    } else {
      button = IconButton.filledTonal(
        key: const ValueKey('mic'),
        tooltip: text.chatMic,
        onPressed: enabled ? onMic : null,
        icon: const Icon(Icons.mic_none_rounded),
      );
    }

    return AnimatedSwitcher(
      duration: AppDurations.fast,
      transitionBuilder: (child, animation) => ScaleTransition(
        scale: CurvedAnimation(parent: animation, curve: Curves.easeOutBack),
        child: FadeTransition(opacity: animation, child: child),
      ),
      child: button,
    );
  }
}

/// The microphone while it listens: a ring swells and fades behind it, and the
/// icon is a stop square, so what the button does is in its shape and its
/// tooltip as well as its motion.
class _ListeningButton extends StatefulWidget {
  const _ListeningButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  State<_ListeningButton> createState() => _ListeningButtonState();
}

class _ListeningButtonState extends State<_ListeningButton> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: ChatConfig.micPulse);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _pulse.stop();
    } else if (!_pulse.isAnimating) {
      _pulse.repeat();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Stack(
      alignment: Alignment.center,
      clipBehavior: Clip.none,
      children: [
        IgnorePointer(
          child: ExcludeSemantics(
            child: AnimatedBuilder(
              animation: _pulse,
              builder: (context, _) => Opacity(
                opacity: _pulse.isAnimating ? 1 - _pulse.value : 0.3,
                child: Container(
                  width: AppSizes.buttonHeightSm * (1 + _pulse.value * 0.6),
                  height: AppSizes.buttonHeightSm * (1 + _pulse.value * 0.6),
                  decoration: BoxDecoration(shape: BoxShape.circle, color: context.colors.primary.withValues(alpha: 0.25)),
                ),
              ),
            ),
          ),
        ),
        IconButton.filled(
          tooltip: text.chatMicStop,
          onPressed: widget.onPressed,
          icon: const Icon(Icons.stop_rounded),
        ),
      ],
    );
  }
}
