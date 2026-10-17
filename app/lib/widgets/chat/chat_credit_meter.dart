import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chat.dart';

/// How much of the reader's credit is left, small enough to sit in the app bar
/// beside the title: "NN% left" over a thin bar. Tapping it shows the rest —
/// their level and when it comes back. The server sends a percentage and a
/// level name and nothing else — this widget has no way to show a token count.
class ChatCreditMeter extends StatelessWidget {
  const ChatCreditMeter({super.key, required this.credits});

  final ChatCredits credits;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final level = credits.levelName;
    final label = text.chatCreditsLeft(credits.percent);
    final full = level == null ? label : text.chatCreditsLeftLevel(credits.percent, level);
    final hint = creditsHint(text, credits.limitedBy, credits.resetsAt ?? credits.renewsAt, credits.renewsAt);
    final tip = hint == null ? full : '$full\n$hint';

    return Semantics(
      label: hint == null ? full : '$full, $hint',
      child: ExcludeSemantics(
        child: Tooltip(
          message: tip,
          triggerMode: TooltipTriggerMode.tap,
          showDuration: ChatConfig.meterTipShown,
          child: ConstrainedBox(
            // A finger-sized target for something drawn small.
            constraints: const BoxConstraints(minHeight: kMinInteractiveDimension),
            child: Center(
              // The label sets the width and the bar stretches to it. (A bar in
              // a column under an `IntrinsicWidth` would ask for an infinite one.)
              child: Stack(
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: ChatConfig.meterHeight + AppSpacing.xs),
                    child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.texts.bodySmall),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: LinearProgressIndicator(
                      value: credits.percent / 100,
                      minHeight: ChatConfig.meterHeight,
                      borderRadius: AppRadius.smAll,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "Resets at midnight" for the daily allowance, "Renews 3 Nov" for the plan's
/// wallet. Null when there is nothing to say.
String? creditsHint(AppLocalizations text, ChatLimitedBy? limitedBy, DateTime? resetsAt, DateTime? renewsAt) {
  if (limitedBy == ChatLimitedBy.daily) return text.chatCreditsResetsMidnight;
  final date = limitedBy == ChatLimitedBy.wallet ? (resetsAt ?? renewsAt) : renewsAt;
  return date == null ? null : text.chatCreditsRenews(date);
}
