import 'json.dart';

/// Whoever wrote a comment. A plain `User`, not a creator — anyone signed in
/// can comment, whether or not they post reels.
class CommentAuthor {
  const CommentAuthor({required this.id, required this.name, this.avatarUrl});

  final String id;
  final String name;
  final String? avatarUrl;

  factory CommentAuthor.fromJson(Json json) => CommentAuthor(
        id: asString(json['id']),
        name: asString(json['name']),
        avatarUrl: asStringOrNull(json['avatarUrl']),
      );
}

/// One comment, or one reply.
///
/// Threads are one level deep — the API flattens a reply-to-a-reply onto the
/// same parent — so this needs no children list. Replies are fetched by
/// [parentId] when a thread is opened, and held beside the parent by the
/// provider rather than nested inside it.
class ReelComment {
  const ReelComment({
    required this.id,
    required this.reelId,
    required this.author,
    this.parentId,
    this.text,
    this.isHidden = false,
    this.isPinned = false,
    this.likeCount = 0,
    this.replyCount = 0,
    this.isLiked = false,
    this.isMine = false,
    this.createdAt,
  });

  final String id;
  final String reelId;
  final String? parentId;
  final CommentAuthor? author;

  /// Null when the comment was hidden by moderation. The row is kept so the
  /// replies under it still make sense, so this is "removed", not "missing".
  final String? text;

  final bool isHidden;
  final bool isPinned;

  final int likeCount;
  final int replyCount;
  final bool isLiked;

  /// Whether the reader wrote it — decides whether a long press offers delete
  /// or report.
  final bool isMine;

  final DateTime? createdAt;

  bool get isReply => parentId != null;
  bool get hasReplies => replyCount > 0;

  factory ReelComment.fromJson(Json json) => ReelComment(
        id: asString(json['id']),
        reelId: asString(json['reelId']),
        parentId: asStringOrNull(json['parentId']),
        author: asJson(json['author']) == null
            ? null
            : CommentAuthor.fromJson(asJson(json['author'])!),
        text: asStringOrNull(json['text']),
        isHidden: asBool(json['isHidden']),
        isPinned: asBool(json['isPinned']),
        likeCount: asInt(json['likeCount']),
        replyCount: asInt(json['replyCount']),
        isLiked: asBool(json['isLiked']),
        isMine: asBool(json['isMine']),
        createdAt: asDate(json['createdAt']),
      );

  ReelComment copyWith({int? likeCount, int? replyCount, bool? isLiked, bool? isPinned}) {
    return ReelComment(
      id: id,
      reelId: reelId,
      parentId: parentId,
      author: author,
      text: text,
      isHidden: isHidden,
      isPinned: isPinned ?? this.isPinned,
      likeCount: likeCount ?? this.likeCount,
      replyCount: replyCount ?? this.replyCount,
      isLiked: isLiked ?? this.isLiked,
      isMine: isMine,
      createdAt: createdAt,
    );
  }
}
