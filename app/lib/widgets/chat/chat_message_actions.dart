import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';

/// Copy, share and (on the last answer) regenerate — under a finished answer.
class ChatMessageActions extends StatelessWidget {
  const ChatMessageActions({super.key, required this.content, this.onRegenerate});

  final String content;

  /// Null on every answer but the last, so older answers carry no control that
  /// would rewrite the wrong turn.
  final VoidCallback? onRegenerate;

  Future<void> _copy(BuildContext context) async {
    final message = AppLocalizations.of(context).chatCopied;
    await Clipboard.setData(ClipboardData(text: content));
    AppNavigator.instance.showMessage(message);
  }

  Future<void> _share() async {
    try {
      await SharePlus.instance.share(ShareParams(text: content));
    } catch (_) {
      // The sheet could not open; nothing was lost.
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: text.chatCopy,
          visualDensity: VisualDensity.compact,
          iconSize: AppSizes.iconSm + AppSpacing.xs,
          onPressed: () => _copy(context),
          icon: const Icon(Icons.copy_rounded),
        ),
        IconButton(
          tooltip: text.chatShare,
          visualDensity: VisualDensity.compact,
          iconSize: AppSizes.iconSm + AppSpacing.xs,
          onPressed: _share,
          icon: const Icon(Icons.ios_share_rounded),
        ),
        if (onRegenerate != null)
          IconButton(
            tooltip: text.chatRegenerate,
            visualDensity: VisualDensity.compact,
            iconSize: AppSizes.iconSm + AppSpacing.xs,
            onPressed: onRegenerate,
            icon: const Icon(Icons.refresh_rounded),
          ),
      ],
    );
  }
}
