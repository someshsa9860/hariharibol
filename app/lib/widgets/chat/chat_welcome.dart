import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../common/animations.dart';
import 'chat_suggestions.dart';
import 'sakha_avatar.dart';

/// An empty chat: who Sakha is, in Sakha's own words, and a row of questions to
/// start with. The description comes from the server (an admin edits it) and
/// says plainly what Sakha is and the tradition the answers come from, so a
/// reader knows before the first question.
class ChatWelcome extends StatelessWidget {
  const ChatWelcome({super.key, required this.description, required this.onPick});

  final String description;

  /// Null when nothing can be sent right now (no credits).
  final ValueChanged<String>? onPick;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final about = description.trim();

    // Centred when there is room; scrolls when there is not (a small phone with
    // the keyboard up).
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.lg, AppSpacing.xl, AppSpacing.md),
                child: FadeSlideIn(
                  child: Column(
                    children: [
                      const SakhaAvatar(size: AppSizes.avatarLg, glow: true),
                      const SizedBox(height: AppSpacing.lg),
                      Text(text.chatIntroTitle, style: context.texts.headlineSmall, textAlign: TextAlign.center),
                      if (about.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.md),
                        Text(about, style: context.texts.bodyMedium, textAlign: TextAlign.center),
                      ],
                      const SizedBox(height: AppSpacing.sm),
                      Text(text.chatIntroHint, style: context.texts.bodySmall, textAlign: TextAlign.center),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              FadeSlideIn(
                index: 1,
                child: Text(text.chatSuggestionsLabel, style: context.texts.labelLarge),
              ),
              ChatSuggestions(onPick: onPick, firstIndex: 2),
            ],
          ),
        ),
      ),
    );
  }
}
