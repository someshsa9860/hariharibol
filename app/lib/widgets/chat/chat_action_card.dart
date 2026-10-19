import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chat.dart';

/// "Open Reels?" — what Sakha offered when the reader asked to be taken somewhere. Sakha can guess wrong, so nothing
/// opens until the reader taps Open; Not now puts it away.
class ChatActionCard extends StatelessWidget {
  const ChatActionCard({super.key, required this.action, required this.onOpen, required this.onDismiss});

  final ChatAction action;
  final VoidCallback onOpen;
  final VoidCallback onDismiss;

  /// The name of the place, in the reader's language: a page by the app's own word for it, a mantra or verse by its
  /// name from the server.
  static String placeName(AppLocalizations text, ChatAction action) {
    switch (action.type) {
      case ChatActionType.page:
        return switch (action.page!) {
          ChatActionPage.home => text.tabHome,
          ChatActionPage.jap => text.tabSadhana,
          ChatActionPage.reels => text.reelsTitle,
          ChatActionPage.read => text.tabLibrary,
          ChatActionPage.routine => text.tabRoutine,
          ChatActionPage.settings => text.settingsTitle,
          ChatActionPage.plans => text.plansTitle,
          ChatActionPage.search => text.tabSearch,
        };
      case ChatActionType.mantra:
      case ChatActionType.verse:
        return action.title ?? '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.xs, AppSpacing.md, 0),
      child: Material(
        color: colors.primaryContainer,
        borderRadius: AppRadius.mdAll,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  text.chatActionQuestion(placeName(text, action)),
                  style: context.texts.bodyMedium?.copyWith(color: colors.onPrimaryContainer),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              TextButton(onPressed: onDismiss, child: Text(text.chatActionNotNow)),
              FilledButton(onPressed: onOpen, child: Text(text.chatActionOpen)),
            ],
          ),
        ),
      ),
    );
  }
}
