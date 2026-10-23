import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/chat_greeting.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/language_chain_provider.dart';
import '../../providers/session_provider.dart';
import '../common/animations.dart';
import 'chat_suggestions.dart';
import 'sakha_avatar.dart';

/// An empty chat — a new reader's, or one that was cleared: a greeting that
/// opens "Hari Bol" and the reader's first name, in their reading language, who
/// Sakha is, and a row of questions to start with. The description comes from the server (an
/// admin edits it) and says plainly what Sakha is and the tradition the answers
/// come from, so a reader knows before the first question.
///
/// The greeting is the app's own text and is never sent to Sakha.
class ChatWelcome extends ConsumerWidget {
  const ChatWelcome({super.key, required this.description, required this.onPick});

  final String description;

  /// Null when nothing can be sent right now (no credits).
  final ValueChanged<String>? onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final about = description.trim();
    final greeting = chatGreeting(
      ref.watch(readingChainProvider),
      ref.watch(currentUserProvider.select((user) => user?.greetingName)),
    );

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
                      Text(
                        text.chatIntroTitle,
                        style: context.texts.labelLarge?.copyWith(color: context.colors.onSurfaceVariant),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(greeting, style: context.texts.headlineSmall, textAlign: TextAlign.center),
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
