import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chat.dart';

/// How much of the reader's credit is left: a slim bar, "NN% left", their level
/// and when it comes back. The server sends a percentage and a level name and
/// nothing else — this widget has no way to show a token count.
class ChatCreditMeter extends StatelessWidget {
  const ChatCreditMeter({super.key, required this.credits});

  /// The height the meter needs, for an app bar's `bottom`.
  static const double extent = 44;

  final ChatCredits credits;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final level = credits.levelName;
    final label = level == null
        ? text.chatCreditsLeft(credits.percent)
        : text.chatCreditsLeftLevel(credits.percent, level);
    final hint = _hint(text);

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
      child: Semantics(
        label: hint == null ? label : '$label, $hint',
        child: ExcludeSemantics(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              LinearProgressIndicator(
                value: credits.percent / 100,
                minHeight: ChatConfig.meterHeight,
                borderRadius: AppRadius.smAll,
              ),
              const SizedBox(height: AppSpacing.xs),
              Row(
                children: [
                  Expanded(
                    child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.texts.bodySmall),
                  ),
                  if (hint != null) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Flexible(
                      child: Text(
                        hint,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                        style: context.texts.bodySmall,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String? _hint(AppLocalizations text) => creditsHint(text, credits.limitedBy, credits.resetsAt ?? credits.renewsAt, credits.renewsAt);
}

/// "Resets at midnight" for the daily allowance, "Renews 3 Nov" for the plan's
/// wallet. Null when there is nothing to say.
String? creditsHint(AppLocalizations text, ChatLimitedBy? limitedBy, DateTime? resetsAt, DateTime? renewsAt) {
  if (limitedBy == ChatLimitedBy.daily) return text.chatCreditsResetsMidnight;
  final date = limitedBy == ChatLimitedBy.wallet ? (resetsAt ?? renewsAt) : renewsAt;
  return date == null ? null : text.chatCreditsRenews(date);
}
