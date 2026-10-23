import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/dev_message.dart';
import '../services/dev_service.dart';
import '../core/constants/app_config.dart';
import '../services/socket_service.dart';
import 'socket_provider.dart';

/// The list of conversations, latest first. A message that arrives over the socket moves its conversation to
/// the top and counts it unread (unless it is the one being read: [openThreadProvider]).
class ConversationsNotifier extends AsyncNotifier<List<DevConversation>> {
  bool _hasMore = false;
  bool get hasMore => _hasMore;

  @override
  Future<List<DevConversation>> build() async {
    ref.listen(socketMessagesProvider, (previous, next) {
      final message = next.value;
      if (message != null && message.event == SocketEvents.chatMessage) _onLive(message);
    });
    final page = await DevService.instance.conversations();
    _hasMore = page.hasMore;
    return page.items;
  }

  void _onLive(SocketMessage message) {
    final list = state.value;
    if (list == null) return;
    final payload = message.payload;
    final incoming = DevMessage.fromJson(payload);
    final index = list.indexWhere((c) => c.id == incoming.conversationId);
    final open = ref.read(openThreadProvider) == incoming.conversationId;

    if (index < 0) {
      // A conversation we have not listed yet — a new reader. Read the list again.
      unawaited(refresh());
      return;
    }
    final existing = list[index];
    final updated = existing.copyWith(
      lastMessageAt: incoming.createdAt,
      lastMessagePreview: incoming.body,
      unread: incoming.fromDeveloper || open ? existing.unread : existing.unread + 1,
    );
    state = AsyncData([updated, ...list.where((c) => c.id != incoming.conversationId)]);
  }

  Future<void> refresh() async {
    final page = await DevService.instance.conversations();
    _hasMore = page.hasMore;
    state = AsyncData(page.items);
  }

  Future<void> loadMore() async {
    final list = state.value;
    if (list == null || !_hasMore || list.isEmpty) return;
    final page = await DevService.instance.conversations(before: list.last.id);
    _hasMore = page.hasMore;
    final seen = list.map((c) => c.id).toSet();
    state = AsyncData([...list, ...page.items.where((c) => !seen.contains(c.id))]);
  }

  void markRead(String conversationId) {
    final list = state.value;
    if (list == null) return;
    state = AsyncData([for (final c in list) c.id == conversationId ? c.copyWith(unread: 0) : c]);
  }
}

final conversationsProvider =
    AsyncNotifierProvider<ConversationsNotifier, List<DevConversation>>(ConversationsNotifier.new);

/// Unread messages across all conversations — the badge on the Chats tab.
final unreadChatsProvider = Provider<int>((ref) {
  final list = ref.watch(conversationsProvider).value ?? const <DevConversation>[];
  return list.fold<int>(0, (sum, c) => sum + c.unread);
});

/// The conversation on screen, if any. While it is open, its new messages are read as they arrive.
class OpenThread extends Notifier<String?> {
  @override
  String? build() => null;

  void set(String? id) => state = id;
}

final openThreadProvider = NotifierProvider<OpenThread, String?>(OpenThread.new);

class ThreadState {
  const ThreadState({required this.conversation, this.messages = const [], this.hasMore = false, this.loadingOlder = false});

  final DevConversation conversation;
  final List<DevMessage> messages;
  final bool hasMore;
  final bool loadingOlder;

  ThreadState copyWith({List<DevMessage>? messages, bool? hasMore, bool? loadingOlder}) => ThreadState(
        conversation: conversation,
        messages: messages ?? this.messages,
        hasMore: hasMore ?? this.hasMore,
        loadingOlder: loadingOlder ?? this.loadingOlder,
      );
}

/// One conversation: its messages oldest-first, live additions from the socket, and sending a reply.
class ThreadNotifier extends AsyncNotifier<ThreadState> {
  ThreadNotifier(this._id);

  final String _id;
  int _localCounter = 0;

  @override
  Future<ThreadState> build() async {
    ref.listen(socketMessagesProvider, (previous, next) {
      final message = next.value;
      if (message == null || message.event != SocketEvents.chatMessage) return;
      final incoming = DevMessage.fromJson(message.payload);
      if (incoming.conversationId == _id) _onLive(incoming);
    });
    final page = await DevService.instance.thread(_id);
    ref.read(conversationsProvider.notifier).markRead(_id);
    return ThreadState(conversation: page.conversation, messages: page.messages, hasMore: page.hasMore);
  }

  void _onLive(DevMessage incoming) {
    final current = state.value;
    if (current == null || current.messages.any((m) => m.id == incoming.id)) return;
    // The server echoes the developer's own reply back over the socket: it replaces the local copy.
    final withoutLocal = incoming.fromDeveloper
        ? current.messages.where((m) => !(m.pending && m.body == incoming.body)).toList()
        : current.messages;
    state = AsyncData(current.copyWith(messages: [...withoutLocal, incoming]));
    if (!incoming.fromDeveloper) unawaited(_markReadQuietly());
  }

  Future<void> _markReadQuietly() async {
    try {
      await DevService.instance.markRead(_id);
    } catch (_) {
      // The unread count is corrected the next time the thread is opened.
    }
  }

  Future<void> loadOlder() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingOlder || current.messages.isEmpty) return;
    state = AsyncData(current.copyWith(loadingOlder: true));
    try {
      final page = await DevService.instance.thread(_id, before: current.messages.first.id);
      final latest = state.value ?? current;
      state = AsyncData(latest.copyWith(messages: [...page.messages, ...latest.messages], hasMore: page.hasMore, loadingOlder: false));
    } catch (_) {
      state = AsyncData((state.value ?? current).copyWith(loadingOlder: false));
      rethrow;
    }
  }

  /// Shows the reply at once, then confirms it with the server; a failure leaves it marked so it can be retried.
  Future<void> send(String body) async {
    final current = state.value;
    if (current == null) return;
    final local = DevMessage(
      id: 'local-${_localCounter++}',
      conversationId: _id,
      fromDeveloper: true,
      body: body,
      createdAt: DateTime.now(),
      pending: true,
    );
    state = AsyncData(current.copyWith(messages: [...current.messages, local]));
    await _deliver(local);
  }

  Future<void> retry(String localId) async {
    final current = state.value;
    if (current == null) return;
    final index = current.messages.indexWhere((m) => m.id == localId);
    if (index < 0) return;
    final local = current.messages[index].copyWith(pending: true, failed: false);
    state = AsyncData(current.copyWith(messages: [...current.messages]..[index] = local));
    await _deliver(local);
  }

  Future<void> _deliver(DevMessage local) async {
    try {
      final saved = await DevService.instance.reply(_id, local.body);
      final latest = state.value;
      if (latest == null) return;
      // The socket may have delivered the saved copy first.
      final already = latest.messages.any((m) => m.id == saved.id);
      final list = [
        for (final m in latest.messages)
          if (m.id == local.id)
            if (!already) saved else ...const <DevMessage>[]
          else
            m,
      ];
      state = AsyncData(latest.copyWith(messages: list));
      ref.read(conversationsProvider.notifier).refresh().ignore();
    } catch (_) {
      final latest = state.value;
      if (latest == null) return;
      state = AsyncData(latest.copyWith(messages: [
        for (final m in latest.messages) m.id == local.id ? m.copyWith(pending: false, failed: true) : m,
      ]));
    }
  }
}

final threadProvider =
    AsyncNotifierProvider.family.autoDispose<ThreadNotifier, ThreadState, String>(ThreadNotifier.new);

/// Starting a conversation: who to write to.
final readerSearchProvider = FutureProvider.family.autoDispose<List<ChatPerson>, String>((ref, query) async {
  if (query.trim().length < 2) return const [];
  return DevService.instance.findReaders(query.trim());
});

