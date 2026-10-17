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

/// A notice above the composer saying what went wrong with the last turn, with
/// Try again where asking once more can help, and a close button. The words are
/// the app's own, in the reader's language — never the server's, a provider's
/// or an exception's; the colour carries nothing, the icon and the words do.
class ChatProblemNotice extends StatelessWidget {
  const ChatProblemNotice({super.key, required this.problem, required this.onRetry, required this.onDismiss});

  final ChatProblem problem;
  final VoidCallback onRetry;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final noSignal = problem.issue == ChatIssue.offline || problem.issue == ChatIssue.connectionLost;
    final message = switch (problem.issue) {
      ChatIssue.offline => text.errorNetwork,
      ChatIssue.timedOut => text.errorTimeout,
      ChatIssue.connectionLost => text.chatConnectionLost,
      ChatIssue.overloaded => text.chatOverloaded,
      ChatIssue.unavailable => text.chatUnavailable,
      ChatIssue.replyFailed => text.chatReplyFailed,
      ChatIssue.busy => text.chatBusy,
      ChatIssue.tooLong => text.chatTooLong,
      ChatIssue.conversationFull => text.chatFullTitle,
      ChatIssue.creditsExhausted || ChatIssue.notAvailable => text.errorGeneric,
      ChatIssue.failed => problem.failure?.ownWords(text) ?? text.errorGeneric,
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
      child: Semantics(
        liveRegion: true,
        child: Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsetsDirectional.only(start: AppSpacing.lg, top: AppSpacing.xs, bottom: AppSpacing.xs),
            child: Row(
              children: [
                Icon(
                  noSignal ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
                  size: AppSizes.iconMd,
                  color: context.colors.onSurfaceVariant,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                    child: Text(message, style: context.texts.bodyMedium),
                  ),
                ),
                if (problem.canRetry) TextButton(onPressed: onRetry, child: Text(text.actionRetry)),
                IconButton(
                  tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                  visualDensity: VisualDensity.compact,
                  onPressed: onDismiss,
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
