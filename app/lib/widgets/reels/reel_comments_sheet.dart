import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/reel_comment.dart';
import '../../providers/reel_comment_provider.dart';
import '../../providers/reel_provider.dart';
import '../../services/tracking_service.dart';
import '../common/app_error_view.dart';
import '../common/app_loader.dart';
import '../common/empty_state.dart';
import 'reel_comment_tile.dart';
import 'reel_report_sheet.dart';

/// The comments on one reel, in a draggable sheet over the video.
///
/// Opened by [show] rather than constructed directly, so every caller gets the
/// same sheet configuration — the reel keeps playing behind it, which is why
/// this is a sheet and not a screen.
class ReelCommentsSheet extends ConsumerStatefulWidget {
  const ReelCommentsSheet({super.key, required this.reelId});

  final String reelId;

  static Future<void> show(BuildContext context, String reelId) {
    unawaitedTracking(reelId);
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      // Half height by default: enough to read the conversation, little enough
      // that the reel it is about is still visible above it.
      builder: (context) => ReelCommentsSheet(reelId: reelId),
    );
  }

  static void unawaitedTracking(String reelId) {
    TrackingService.instance.log('reel_comments_open', parameters: {'reel_id': reelId});
  }

  @override
  ConsumerState<ReelCommentsSheet> createState() => _ReelCommentsSheetState();
}

class _ReelCommentsSheetState extends ConsumerState<ReelCommentsSheet> {
  final TextEditingController _field = TextEditingController();
  final FocusNode _focus = FocusNode();
  final ScrollController _scroll = ScrollController();

  /// Set while replying, so the field knows where to attach what is typed.
  ReelComment? _replyingTo;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final remaining = _scroll.position.maxScrollExtent - _scroll.position.pixels;
    if (remaining < _loadMoreAt) {
      ref.read(reelCommentsProvider(widget.reelId).notifier).loadMore();
    }
  }

  static const double _loadMoreAt = 400;

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _field.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _field.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);
    try {
      await ref
          .read(reelCommentsProvider(widget.reelId).notifier)
          .add(text, parentId: _replyingTo?.id);

      // The count under the video is the reel's, not the sheet's, so the feed
      // is told about it rather than left to refetch.
      ref.read(reelFeedProvider.notifier).adjustCommentCount(widget.reelId, 1);

      TrackingService.instance.log('reel_comment_add', parameters: {
        'reel_id': widget.reelId,
        'is_reply': (_replyingTo != null).toString(),
      });

      _field.clear();
      setState(() => _replyingTo = null);
    } on ApiFailure catch (failure) {
      // Deliberately not clearing the field — losing what someone typed is the
      // worst thing that can happen here.
      AppNavigator.instance.showFailure(failure);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _startReply(ReelComment comment) {
    setState(() => _replyingTo = comment);
    _focus.requestFocus();
  }

  Future<void> _delete(ReelComment comment) async {
    final text = AppLocalizations.of(context);
    final confirmed = await AppNavigator.instance.confirm(
      title: text.reelCommentDeleteTitle,
      message: text.reelCommentDeleteBody,
      confirmLabel: text.reelCommentDelete,
      isDestructive: true,
    );
    if (!confirmed) return;

    try {
      final lost =
          await ref.read(reelCommentsProvider(widget.reelId).notifier).remove(comment);
      ref.read(reelFeedProvider.notifier).adjustCommentCount(widget.reelId, -lost);
      AppNavigator.instance.showMessage(text.reelCommentDeleted);
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    }
  }

  Future<void> _more(ReelComment comment) async {
    final text = AppLocalizations.of(context);

    await showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (comment.isMine)
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded),
                title: Text(text.reelCommentDelete),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _delete(comment);
                },
              )
            else
              ListTile(
                leading: const Icon(Icons.flag_outlined),
                title: Text(text.reelCommentReport),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  ReelReportSheet.showForComment(context, comment.id);
                },
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final thread = ref.watch(reelCommentsProvider(widget.reelId));

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, sheetScroll) => Column(
        children: [
          _Grabber(
            title: thread.value == null
                ? text.reelCommentsTitle
                : text.reelCommentsCount(thread.value!.total),
          ),
          Expanded(
            child: thread.when(
              loading: () => const AppLoader(),
              error: (error, _) => AppErrorView(
                failure: error is ApiFailure
                    ? error
                    : ApiFailure(kind: FailureKind.unknown, message: text.reelsFailed),
                onRetry: () async => ref.invalidate(reelCommentsProvider(widget.reelId)),
              ),
              data: (data) => data.comments.isEmpty
                  ? EmptyState(
                      message: text.reelCommentsEmpty,
                      icon: Icons.mode_comment_outlined,
                    )
                  : _CommentList(
                      thread: data,
                      controller: _scroll,
                      sheetController: sheetScroll,
                      reelId: widget.reelId,
                      onReply: _startReply,
                      onMore: _more,
                    ),
            ),
          ),
          _Composer(
            controller: _field,
            focus: _focus,
            sending: _sending,
            replyingTo: _replyingTo,
            onCancelReply: () => setState(() => _replyingTo = null),
            onSend: _send,
          ),
        ],
      ),
    );
  }
}

class _Grabber extends StatelessWidget {
  const _Grabber({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          child: Container(
            width: AppSpacing.xxxl,
            height: AppSpacing.xs,
            decoration: BoxDecoration(
              color: context.colors.outlineVariant,
              borderRadius: AppRadius.smAll,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Text(title, style: context.texts.titleMedium),
        ),
        Divider(height: 1, color: context.colors.outlineVariant),
      ],
    );
  }
}

/// The list itself.
///
/// Replies are rendered inline under their parent rather than in a nested
/// list — the provider keeps them flat for exactly this reason, so one
/// `ListView` renders the whole thread.
class _CommentList extends ConsumerWidget {
  const _CommentList({
    required this.thread,
    required this.controller,
    required this.sheetController,
    required this.reelId,
    required this.onReply,
    required this.onMore,
  });

  final CommentThread thread;
  final ScrollController controller;
  final ScrollController sheetController;
  final String reelId;
  final void Function(ReelComment) onReply;
  final void Function(ReelComment) onMore;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(reelCommentsProvider(reelId).notifier);

    // Flattened once, here: each parent followed by its replies when open.
    final rows = <(ReelComment, bool)>[];
    for (final comment in thread.comments) {
      rows.add((comment, false));
      if (thread.expanded.contains(comment.id)) {
        for (final reply in thread.replies[comment.id] ?? const <ReelComment>[]) {
          rows.add((reply, true));
        }
      }
    }

    return ListView.builder(
      controller: sheetController,
      padding: AppSpacing.page,
      itemCount: rows.length,
      itemBuilder: (context, index) {
        final (comment, isReply) = rows[index];
        return ReelCommentTile(
          comment: comment,
          isReply: isReply,
          isExpanded: thread.expanded.contains(comment.id),
          onLike: () => notifier.toggleLike(comment),
          onReply: () => onReply(comment),
          onMore: () => onMore(comment),
          onToggleReplies: isReply ? null : () => notifier.toggleReplies(comment.id),
        );
      },
    );
  }
}

/// The field along the bottom. Lifts above the keyboard on its own, so the
/// sheet does not have to know the keyboard exists.
class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.focus,
    required this.sending,
    required this.replyingTo,
    required this.onCancelReply,
    required this.onSend,
  });

  final TextEditingController controller;
  final FocusNode focus;
  final bool sending;
  final ReelComment? replyingTo;
  final VoidCallback onCancelReply;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final replying = replyingTo;

    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        border: Border(top: BorderSide(color: context.colors.outlineVariant)),
      ),
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.sm,
        top: AppSpacing.sm,
        bottom: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.sm,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (replying != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      text.reelReplyHint(replying.author?.name ?? ''),
                      style: context.texts.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: AppSizes.iconSm),
                    tooltip: text.reelCommentCancelReply,
                    onPressed: onCancelReply,
                  ),
                ],
              ),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  focusNode: focus,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => onSend(),
                  decoration: InputDecoration(
                    hintText: replying == null
                        ? text.reelCommentHint
                        : text.reelReplyHint(replying.author?.name ?? ''),
                    border: InputBorder.none,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              if (sending)
                const Padding(
                  padding: EdgeInsets.all(AppSpacing.md),
                  child: SizedBox(
                    width: AppSizes.iconSm,
                    height: AppSizes.iconSm,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              else
                IconButton(
                  icon: const Icon(Icons.send_rounded),
                  tooltip: text.reelCommentSend,
                  onPressed: onSend,
                ),
            ],
          ),
        ],
      ),
    );
  }
}
