import 'dart:async';

import 'package:in_app_review/in_app_review.dart';

import '../core/constants/storage_keys.dart';
import '../core/constants/support_config.dart';
import '../core/navigation/app_navigator.dart';
import '../widgets/support/feedback_sheet.dart';
import '../widgets/support/review_prompt_sheet.dart';
import 'local_store.dart';
import 'support_service.dart';

/// Asks for a store rating at a happy moment, and not otherwise.
///
/// Three gates, cheapest first: the phone's own (never within
/// [SupportConfig.reviewMinGap] of the last time), the server's (a streak of
/// chanting days or a finished session, nothing within 60 days of writing in,
/// nothing after unhappy feedback — `backend/services/support.js`), and the
/// store's own quota, which decides whether its sheet really appears. The
/// store's sheet is only reached through an "Enjoying HariHariBol?" yes; a no
/// goes to the feedback sheet instead. Every step is recorded on the server.
class ReviewPrompter {
  ReviewPrompter._();

  static final ReviewPrompter instance = ReviewPrompter._();

  final InAppReview _review = InAppReview.instance;
  bool _running = false;

  bool get _gateOpen {
    final last = LocalStore.instance.read<int>(BoxKeys.reviewPromptAt);
    if (last == null) return true;
    return DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(last)) >= SupportConfig.reviewMinGap;
  }

  /// Never throws and never blocks the screen that called it.
  Future<void> maybeAsk({required String trigger}) async {
    if (_running || !_gateOpen) return;
    _running = true;
    try {
      if (!await SupportService.instance.shouldAskForReview(trigger)) return;
      if (!await _review.isAvailable()) return;

      // Let the screen that just closed settle before something rises over it.
      await Future<void>.delayed(SupportConfig.reviewPromptDelay);
      final context = AppNavigator.instance.context;
      if (context == null || !context.mounted) return;

      await LocalStore.instance.write(BoxKeys.reviewPromptAt, DateTime.now().millisecondsSinceEpoch);
      final answer = await ReviewPromptSheet.show(context);
      switch (answer) {
        case ReviewAnswer.liked:
          unawaited(_record(trigger, 'LIKED'));
          await _review.requestReview();
          unawaited(_record(trigger, 'SHOWN'));
        case ReviewAnswer.unhappy:
          unawaited(_record(trigger, 'UNHAPPY'));
          final next = AppNavigator.instance.context;
          if (next != null && next.mounted) await FeedbackSheet.show(next);
        case ReviewAnswer.dismissed:
          unawaited(_record(trigger, 'DISMISSED'));
      }
    } catch (_) {
      // A rating prompt is never worth an error.
    } finally {
      _running = false;
    }
  }

  Future<void> _record(String trigger, String outcome) async {
    try {
      await SupportService.instance.recordReviewPrompt(trigger, outcome);
    } catch (_) {}
  }
}
