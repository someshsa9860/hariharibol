import 'package:flutter/material.dart';

import '../../core/constants/support_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../services/support_service.dart';
import 'star_rating.dart';

/// Quick feedback: stars and an optional note. Pops with true once it is sent.
///
/// Shown on the root navigator so it sits over the tab bar (the same as every
/// other sheet in the app).
class FeedbackSheet extends StatefulWidget {
  const FeedbackSheet._();

  static Future<bool> show(BuildContext context) async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      builder: (_) => const FeedbackSheet._(),
    );
    return sent ?? false;
  }

  @override
  State<FeedbackSheet> createState() => _FeedbackSheetState();
}

class _FeedbackSheetState extends State<FeedbackSheet> {
  final TextEditingController _note = TextEditingController();
  int _rating = 0;
  bool _sending = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_rating == 0 || _sending) return;
    final text = AppLocalizations.of(context);
    setState(() => _sending = true);
    try {
      await SupportService.instance.sendFeedback(
        category: SupportConfig.feedbackCategory,
        rating: _rating,
        note: _note.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
      AppNavigator.instance.showMessage(text.supportFeedbackThanks);
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: SingleChildScrollView(
          child: Padding(
            padding: AppSpacing.card,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text.supportFeedbackTitle, style: context.texts.titleLarge),
                const SizedBox(height: AppSpacing.md),
                Center(child: StarRating(value: _rating, onChanged: (value) => setState(() => _rating = value))),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: _note,
                  minLines: 2,
                  maxLines: 4,
                  maxLength: SupportConfig.ticketMaxChars,
                  decoration: InputDecoration(hintText: text.supportFeedbackNoteHint, border: const OutlineInputBorder()),
                ),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _rating == 0 || _sending ? null : _send,
                    style: FilledButton.styleFrom(minimumSize: const Size(0, AppSizes.buttonHeight)),
                    child: Text(text.supportSend),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
