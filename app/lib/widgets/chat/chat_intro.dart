import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// What the assistant is, in its own words. The description comes from the
/// server (an admin edits it) and states the tradition it answers from — the
/// Sri Vaishnava orientation — so a reader knows before the first question.
/// Shown in the empty list and at the top of a chat with nothing in it.
class ChatIntro extends StatelessWidget {
  const ChatIntro({super.key, required this.description, this.action});

  final String description;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: AppSizes.readingMaxWidth),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.chat_bubble_outline_rounded, size: AppSizes.iconLg, color: context.colors.primary),
              const SizedBox(height: AppSpacing.lg),
              Text(text.chatIntroTitle, style: context.texts.headlineSmall, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.md),
              if (description.trim().isNotEmpty)
                Text(
                  description.trim(),
                  style: context.texts.bodyMedium,
                  textAlign: TextAlign.center,
                ),
              if (description.trim().isNotEmpty) const SizedBox(height: AppSpacing.md),
              Text(
                text.chatIntroHint,
                style: context.texts.bodySmall,
                textAlign: TextAlign.center,
              ),
              if (action != null) ...[
                const SizedBox(height: AppSpacing.xl),
                action!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}
