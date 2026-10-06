import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/reel.dart';
import '../../services/reel_service.dart';
import '../../services/tracking_service.dart';

/// Reporting a reel or a comment.
///
/// One sheet for both, because the two differ only in which endpoint the
/// submit hits — the reasons, the copy and the shape are identical, and two
/// files would drift the moment a reason is added.
class ReelReportSheet extends StatefulWidget {
  const ReelReportSheet._({required this.targetId, required this.isComment});

  final String targetId;
  final bool isComment;

  static Future<void> showForReel(BuildContext context, String reelId) {
    return _show(context, targetId: reelId, isComment: false);
  }

  static Future<void> showForComment(BuildContext context, String commentId) {
    return _show(context, targetId: commentId, isComment: true);
  }

  static Future<void> _show(
    BuildContext context, {
    required String targetId,
    required bool isComment,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      builder: (context) => ReelReportSheet._(targetId: targetId, isComment: isComment),
    );
  }

  @override
  State<ReelReportSheet> createState() => _ReelReportSheetState();
}

class _ReelReportSheetState extends State<ReelReportSheet> {
  final TextEditingController _note = TextEditingController();
  ReportReason? _reason;
  bool _sending = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reason = _reason;
    if (reason == null || _sending) return;

    final text = AppLocalizations.of(context);
    setState(() => _sending = true);

    try {
      final note = _note.text.trim();
      if (widget.isComment) {
        await ReelService.instance.reportComment(widget.targetId, reason, note: note);
      } else {
        await ReelService.instance.report(widget.targetId, reason, note: note);
      }

      TrackingService.instance.log('reel_report', parameters: {
        'target': widget.isComment ? 'comment' : 'reel',
        'reason': reason.wire,
      });

      if (mounted) Navigator.of(context).pop();
      AppNavigator.instance.showMessage(text.reelReportThanks);
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
      if (mounted) setState(() => _sending = false);
    }
  }

  /// The labels, in the order they are offered. Kept beside the enum rather
  /// than in a switch inside the list builder, so adding a reason is one line
  /// in two places instead of five in four.
  Map<ReportReason, String> _labels(AppLocalizations text) => {
        ReportReason.spam: text.reelReportSpam,
        ReportReason.harassment: text.reelReportHarassment,
        ReportReason.nonDevotional: text.reelReportNonDevotional,
        ReportReason.misinformation: text.reelReportMisinformation,
        ReportReason.sexualOrViolent: text.reelReportSexualOrViolent,
        ReportReason.other: text.reelReportOther,
      };

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
                Text(
                  widget.isComment ? text.reelReportCommentTitle : text.reelReportTitle,
                  style: context.texts.titleLarge,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(text.reelReportBody, style: context.texts.bodySmall),
                const SizedBox(height: AppSpacing.md),
                // RadioGroup owns the selection; the tiles only declare their
                // own value. That is the arrangement Flutter moved to after
                // 3.32 — per-tile groupValue/onChanged are deprecated.
                RadioGroup<ReportReason>(
                  groupValue: _reason,
                  onChanged: (value) => setState(() => _reason = value),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final entry in _labels(text).entries)
                        RadioListTile<ReportReason>(
                          value: entry.key,
                          title: Text(entry.value),
                          contentPadding: EdgeInsets.zero,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: _note,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(
                    hintText: text.reelReportNoteHint,
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    // Disabled until a reason is picked — a report with no
                    // reason is not something a moderator can act on.
                    onPressed: _reason == null || _sending ? null : _submit,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, AppSizes.buttonHeight),
                    ),
                    child: Text(text.reelReportSubmit),
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
