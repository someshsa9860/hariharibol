import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chat.dart';
import 'chat_credit_meter.dart';

/// Why the reader cannot send, and what to do about it.
enum ChatCreditsKind {
  /// The plan has no chat.
  notAvailable,

  /// Today's allowance is used; it refills at midnight.
  daily,

  /// The plan's credits are used; they renew with the plan.
  wallet,

  /// This one chat has used its share; a new chat carries on.
  chatShare,
}

/// The "out of credits" card above the composer: what happened, when it lifts,
/// and an **Upgrade** button where a higher plan exists.
class ChatCreditsCard extends StatelessWidget {
  const ChatCreditsCard({
    super.key,
    required this.kind,
    required this.canUpgrade,
    required this.onUpgrade,
    this.resetsAt,
    this.onStartNewChat,
  });

  final ChatCreditsKind kind;
  final bool canUpgrade;
  final DateTime? resetsAt;
  final VoidCallback onUpgrade;

  /// Offered for [ChatCreditsKind.chatShare].
  final VoidCallback? onStartNewChat;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final (title, body) = switch (kind) {
      ChatCreditsKind.notAvailable => (text.chatNotAvailableTitle, text.chatNotAvailableBody),
      ChatCreditsKind.daily => (text.chatExhaustedDailyTitle, text.chatExhaustedDailyBody),
      ChatCreditsKind.wallet => (text.chatExhaustedWalletTitle, text.chatExhaustedWalletBody),
      ChatCreditsKind.chatShare => (text.chatShareUsedTitle, text.chatShareUsedBody),
    };
    final hint = switch (kind) {
      ChatCreditsKind.daily => creditsHint(text, ChatLimitedBy.daily, resetsAt, null),
      ChatCreditsKind.wallet => creditsHint(text, ChatLimitedBy.wallet, resetsAt, null),
      _ => null,
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.md),
      child: Card(
        child: Padding(
          padding: AppSpacing.card,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.hourglass_empty_rounded, size: AppSizes.iconMd, color: context.colors.primary),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: Text(title, style: context.texts.titleMedium)),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(body, style: context.texts.bodyMedium),
              if (hint != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(hint, style: context.texts.bodySmall),
              ],
              if (canUpgrade || onStartNewChat != null) const SizedBox(height: AppSpacing.lg),
              if (canUpgrade)
                FilledButton(onPressed: onUpgrade, child: Text(text.chatUpgrade)),
              if (canUpgrade && onStartNewChat != null) const SizedBox(height: AppSpacing.sm),
              if (onStartNewChat != null)
                OutlinedButton(onPressed: onStartNewChat, child: Text(text.chatStartNewChat)),
            ],
          ),
        ),
      ),
    );
  }
}
