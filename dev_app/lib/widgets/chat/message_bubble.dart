import 'package:flutter/material.dart';

import '../../core/format/time_format.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';

/// One message in a conversation. The developer's are on the right; the reader's on the left.
class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.body,
    required this.createdAt,
    required this.mine,
    this.pending = false,
    this.failed = false,
    this.onRetry,
  });

  final String body;
  final DateTime createdAt;
  final bool mine;
  final bool pending;
  final bool failed;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final locale = Localizations.localeOf(context).toString();
    final maxWidth = MediaQuery.sizeOf(context).width * AppSpacing.bubbleMaxShare;

    final bubble = Container(
      constraints: BoxConstraints(maxWidth: maxWidth),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: mine ? scheme.primaryContainer : scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // A failed message is retried by tapping it, which selectable text would swallow.
          failed ? Text(body) : SelectableText(body),
          const SizedBox(height: AppSpacing.xs),
          Text(
            failed ? text.chatNotSent : (pending ? text.chatSending : whenText(text, locale, createdAt)),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: failed ? scheme.error : scheme.outline),
          ),
        ],
      ),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter, vertical: AppSpacing.xs),
      child: Align(
        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
        child: failed && onRetry != null ? GestureDetector(onTap: onRetry, child: bubble) : bubble,
      ),
    );
  }
}
