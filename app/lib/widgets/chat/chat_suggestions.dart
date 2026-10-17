import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../common/animations.dart';

/// One suggested question: a short title for the card and the full question
/// that is sent when it is tapped.
class ChatStarter {
  const ChatStarter({required this.icon, required this.title, required this.prompt});

  final IconData icon;
  final String title;
  final String prompt;
}

/// The cards on an empty chat. They are static, translated text — the same five
/// questions in every language, chosen to show what Sakha is good for.
List<ChatStarter> chatStarters(AppLocalizations text) => [
      ChatStarter(icon: Icons.menu_book_outlined, title: text.chatStarter1Title, prompt: text.chatStarter1Prompt),
      ChatStarter(icon: Icons.self_improvement_rounded, title: text.chatStarter2Title, prompt: text.chatStarter2Prompt),
      ChatStarter(icon: Icons.wb_sunny_outlined, title: text.chatStarter3Title, prompt: text.chatStarter3Prompt),
      ChatStarter(icon: Icons.waves_rounded, title: text.chatStarter4Title, prompt: text.chatStarter4Prompt),
      ChatStarter(icon: Icons.auto_stories_outlined, title: text.chatStarter5Title, prompt: text.chatStarter5Prompt),
    ];

/// A row of cards that scrolls sideways, each coming in a moment after the one
/// before. Tapping one asks its question at once.
class ChatSuggestions extends StatelessWidget {
  const ChatSuggestions({super.key, required this.onPick, this.firstIndex = 0});

  /// Null when nothing can be sent right now: the cards stay, dimmed.
  final ValueChanged<String>? onPick;

  /// Where in the screen's staggered entrance the first card falls.
  final int firstIndex;

  @override
  Widget build(BuildContext context) {
    final starters = chatStarters(AppLocalizations.of(context));

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      // Room above and below for the card's shadow, which the scroll view
      // would otherwise cut off.
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < starters.length; i++) ...[
              if (i > 0) const SizedBox(width: AppSpacing.md),
              FadeSlideIn(
                index: firstIndex + i,
                step: ChatConfig.suggestionStagger,
                child: _StarterCard(
                  starter: starters[i],
                  onTap: onPick == null ? null : () => onPick!(starters[i].prompt),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StarterCard extends StatelessWidget {
  const _StarterCard({required this.starter, required this.onTap});

  final ChatStarter starter;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      enabled: onTap != null,
      label: starter.title,
      hint: starter.prompt,
      excludeSemantics: true,
      onTap: onTap,
      child: TapScale(
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.5 : 1,
          child: SizedBox(
            width: ChatConfig.suggestionWidth,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: ChatConfig.suggestionHeight),
              child: Card(
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: AppSpacing.card,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(color: colors.primaryContainer, shape: BoxShape.circle),
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.sm),
                          child: Icon(starter.icon, size: AppSizes.iconMd - AppSpacing.xs, color: colors.onPrimaryContainer),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(starter.title, style: context.texts.titleSmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        starter.prompt,
                        style: context.texts.bodySmall,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Quick replies under Sakha's latest answer. Each is a whole question and is
/// sent as it is written.
class ChatFollowUps extends StatelessWidget {
  const ChatFollowUps({super.key, required this.onPick});

  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final replies = [text.chatFollowUp1, text.chatFollowUp2, text.chatFollowUp3, text.chatFollowUp4];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Row(
        children: [
          for (var i = 0; i < replies.length; i++) ...[
            if (i > 0) const SizedBox(width: AppSpacing.sm),
            ActionChip(label: Text(replies[i]), onPressed: () => onPick(replies[i])),
          ],
        ],
      ),
    );
  }
}
