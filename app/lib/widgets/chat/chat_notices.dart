import 'package:flutter/material.dart';

import '../../core/format/failure_text.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/chat_state.dart';

/// "Chat is full": shown in place of the composer. Starting a new chat carries
/// the conversation's summary forward, so nothing has to be repeated.
class ChatFullBanner extends StatelessWidget {
  const ChatFullBanner({super.key, required this.onStartNewChat, this.busy = false});

  final VoidCallback onStartNewChat;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.md),
        child: Card(
          child: Padding(
            padding: AppSpacing.card,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.forum_outlined, size: AppSizes.iconMd, color: context.colors.primary),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: Text(text.chatFullTitle, style: context.texts.titleMedium)),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(text.chatFullBody, style: context.texts.bodyMedium),
                const SizedBox(height: AppSpacing.lg),
                FilledButton(
                  onPressed: busy ? null : onStartNewChat,
                  child: Text(text.chatStartNewChat),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A line above the composer saying what went wrong with the last turn, with
/// Try again where asking once more can help. The words are the app's own, in
/// the reader's language; the colour carries nothing, the icon and the words do.
class ChatProblemNotice extends StatelessWidget {
  const ChatProblemNotice({super.key, required this.problem, required this.onRetry});

  final ChatProblem problem;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final offline = problem.issue == ChatIssue.connectionLost;
    final message = switch (problem.issue) {
      ChatIssue.connectionLost => text.chatConnectionLost,
      ChatIssue.replyFailed => text.chatReplyFailed,
      ChatIssue.busy => text.chatBusy,
      ChatIssue.tooLong => text.chatTooLong,
      ChatIssue.conversationFull => text.chatFullTitle,
      ChatIssue.creditsExhausted || ChatIssue.notAvailable => text.errorGeneric,
      ChatIssue.failed => problem.failure?.describe(text) ?? text.errorGeneric,
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.xs, AppSpacing.lg, 0),
      child: Row(
        children: [
          Icon(
            offline ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
            size: AppSizes.iconMd,
            color: context.colors.onSurfaceVariant,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(child: Text(message, style: context.texts.bodyMedium)),
          if (problem.canRetry) ...[
            const SizedBox(width: AppSpacing.sm),
            TextButton(onPressed: onRetry, child: Text(text.actionRetry)),
          ],
        ],
      ),
    );
  }
}
