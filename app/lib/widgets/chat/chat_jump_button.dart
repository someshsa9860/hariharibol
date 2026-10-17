import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';

/// "Latest": scrolls the chat back down to the newest message once the reader
/// has gone up to read an earlier one. It slides in from below and out again.
class ChatJumpButton extends StatelessWidget {
  const ChatJumpButton({super.key, required this.visible, required this.onPressed});

  final bool visible;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    final duration = still ? Duration.zero : AppDurations.normal;

    return IgnorePointer(
      ignoring: !visible,
      child: AnimatedSlide(
        duration: duration,
        curve: Curves.easeOutCubic,
        offset: visible ? Offset.zero : const Offset(0, 1.5),
        child: AnimatedOpacity(
          duration: duration,
          opacity: visible ? 1 : 0,
          child: FilledButton.tonalIcon(
            onPressed: onPressed,
            icon: const Icon(Icons.keyboard_arrow_down_rounded),
            label: Text(AppLocalizations.of(context).chatJumpToLatest),
          ),
        ),
      ),
    );
  }
}
