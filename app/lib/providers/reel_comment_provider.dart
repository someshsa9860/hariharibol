import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/api_failure.dart';
import '../models/reel_comment.dart';
import '../services/reel_service.dart';

/// A thread: the top-level comments, plus whichever replies have been opened.
///
/// Replies are held in a map beside the parents rather than nested inside
/// them. The API returns a flat list either way — threads are one level deep —
/// and keeping them flat means posting a reply updates one map entry instead
/// of rebuilding a tree.
class CommentThread {
  const CommentThread({
    this.comments = const [],
    this.replies = const {},
    this.expanded = const {},
    this.page = 1,
    this.hasMore = false,
    this.total = 0,
  });

  final List<ReelComment> comments;

  /// parentId → its replies, for threads that have been opened.
  final Map<String, List<ReelComment>> replies;

  /// Which parents are currently showing their replies.
  final Set<String> expanded;

  final int page;
  final bool hasMore;

  /// Every comment on the reel, replies included — what the count under the
  /// video says.
  final int total;

  CommentThread copyWith({
    List<ReelComment>? comments,
    Map<String, List<ReelComment>>? replies,
    Set<String>? expanded,
    int? page,
    bool? hasMore,
    int? total,
  }) {
    return CommentThread(
      comments: comments ?? this.comments,
      replies: replies ?? this.replies,
      expanded: expanded ?? this.expanded,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      total: total ?? this.total,
    );
  }
}

/// Comments on one reel.
///
/// Posting is optimistic in the one way that matters: the sheet clears the
/// field and scrolls to the new comment immediately. It is not faked in the
/// list — a comment needs a server id before it can be liked or deleted, so
/// the real row replaces nothing, it simply arrives.
class ReelCommentsNotifier extends AsyncNotifier<CommentThread> {
  /// Riverpod 3 hands a family's argument to the notifier's constructor, not
  /// to `build` — so the reel this thread belongs to is a field, and `build`
  /// keeps the no-argument signature `AsyncNotifier` declares.
  ReelCommentsNotifier(this._reelId);

  final String _reelId;

  @override
  Future<CommentThread> build() async {
    final page = await ReelService.instance.comments(_reelId);
    return CommentThread(
      comments: page.items,
      page: page.page,
      hasMore: page.hasMore,
      total: page.total,
    );
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore) return;

    final next = await ReelService.instance.comments(_reelId, page: current.page + 1);
    final seen = current.comments.map((c) => c.id).toSet();
    state = AsyncData(current.copyWith(
      comments: [...current.comments, ...next.items.where((c) => !seen.contains(c.id))],
      page: next.page,
      hasMore: next.hasMore,
      total: next.total,
    ));
  }

  /// Opens or closes a reply thread, fetching it the first time.
  Future<void> toggleReplies(String parentId) async {
    final current = state.value;
    if (current == null) return;

    if (current.expanded.contains(parentId)) {
      state = AsyncData(current.copyWith(expanded: <String>{...current.expanded}..remove(parentId)));
      return;
    }

    state = AsyncData(current.copyWith(expanded: {...current.expanded, parentId}));

    if (current.replies.containsKey(parentId)) return;

    try {
      final page = await ReelService.instance.comments(_reelId, parentId: parentId);
      final latest = state.value ?? current;
      state = AsyncData(latest.copyWith(
        replies: {...latest.replies, parentId: page.items},
      ));
    } on ApiFailure {
      final latest = state.value ?? current;
      state = AsyncData(latest.copyWith(expanded: <String>{...latest.expanded}..remove(parentId)));
      rethrow;
    }
  }

  /// Returns the comment so the sheet can scroll to it. Throws [ApiFailure] on
  /// a rejected comment — the sheet shows that rather than swallowing it,
  /// because losing what someone typed is the worst outcome here.
  Future<ReelComment> add(String text, {String? parentId}) async {
    final posted = await ReelService.instance.addComment(_reelId, text, parentId: parentId);
    final current = state.value ?? const CommentThread();

    if (parentId == null) {
      // Newest first at the top level, but under any pinned comment.
      final pinned = current.comments.where((c) => c.isPinned).toList();
      final rest = current.comments.where((c) => !c.isPinned).toList();
      state = AsyncData(current.copyWith(
        comments: [...pinned, posted, ...rest],
        total: current.total + 1,
      ));
      return posted;
    }

    // Replies read oldest first, so a new one goes at the end.
    final existing = current.replies[parentId] ?? const [];
    state = AsyncData(current.copyWith(
      replies: {...current.replies, parentId: [...existing, posted]},
      expanded: {...current.expanded, parentId},
      comments: [
        for (final c in current.comments)
          if (c.id == parentId) c.copyWith(replyCount: c.replyCount + 1) else c,
      ],
      total: current.total + 1,
    ));
    return posted;
  }

  /// How many rows went away — the reel's count has to come down by the whole
  /// subtree, not by one, and the sheet's caller needs that number.
  Future<int> remove(ReelComment comment) async {
    final current = state.value;
    if (current == null) return 0;

    await ReelService.instance.deleteComment(comment.id);

    if (comment.isReply) {
      final siblings = (current.replies[comment.parentId] ?? const [])
          .where((c) => c.id != comment.id)
          .toList();
      state = AsyncData(current.copyWith(
        replies: {...current.replies, comment.parentId!: siblings},
        comments: [
          for (final c in current.comments)
            if (c.id == comment.parentId)
              c.copyWith(replyCount: (c.replyCount - 1).clamp(0, 1 << 30))
            else
              c,
        ],
        total: (current.total - 1).clamp(0, 1 << 30),
      ));
      return 1;
    }

    // Deleting a parent takes its replies with it, server side and here.
    final lost = 1 + comment.replyCount;
    state = AsyncData(current.copyWith(
      comments: current.comments.where((c) => c.id != comment.id).toList(),
      replies: <String, List<ReelComment>>{...current.replies}..remove(comment.id),
      expanded: <String>{...current.expanded}..remove(comment.id),
      total: (current.total - lost).clamp(0, 1 << 30),
    ));
    return lost;
  }

  Future<void> toggleLike(ReelComment comment) async {
    final wanted = !comment.isLiked;

    void apply(bool liked, int count) {
      final current = state.value;
      if (current == null) return;
      ReelComment update(ReelComment c) =>
          c.id == comment.id ? c.copyWith(isLiked: liked, likeCount: count) : c;

      state = AsyncData(current.copyWith(
        comments: current.comments.map(update).toList(),
        replies: {
          for (final entry in current.replies.entries)
            entry.key: entry.value.map(update).toList(),
        },
      ));
    }

    apply(wanted, (comment.likeCount + (wanted ? 1 : -1)).clamp(0, 1 << 30));

    try {
      final result = await ReelService.instance.setCommentLiked(comment.id, wanted);
      apply(result.isOn, result.count);
    } on ApiFailure {
      apply(comment.isLiked, comment.likeCount);
    }
  }
}

final reelCommentsProvider =
    AsyncNotifierProvider.family<ReelCommentsNotifier, CommentThread, String>(
  ReelCommentsNotifier.new,
);
