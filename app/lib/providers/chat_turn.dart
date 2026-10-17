import 'dart:async';

import '../models/chat.dart';
import '../services/api_client.dart';
import 'chat_state.dart';

/// One turn of the conversation in flight: the question and the answer being
/// written, and what is known about how far it got.
class ChatTurn {
  ChatTurn({
    required this.userKey,
    required this.answerKey,
    required this.draft,
    required this.regenerate,
    this.image,
  });

  /// Local keys of the optimistic bubbles. `userKey` is null for a regeneration.
  final String? userKey;
  final String answerKey;

  /// The question's text and picture, handed back to the composer if the
  /// server refuses it.
  final String? draft;
  final ChatDraftImage? image;
  final bool regenerate;

  final ApiCancelToken cancel = ApiCancelToken();
  final Completer<void> done = Completer<void>();
  StreamSubscription<ChatStreamEvent>? sub;

  /// The server saved the question (a `meta` arrived).
  bool gotMeta = false;

  /// `done` or `error` arrived: the stream ended on purpose.
  bool terminal = false;
  bool stopped = false;

  /// The question is on the server, so asking the reply again is safe.
  bool get questionSaved => regenerate || gotMeta;
}
