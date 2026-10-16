import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/chat.dart';
import '../services/chat_service.dart';
import 'session_provider.dart';

/// The service behind the chat. A provider so a test can hand in a fake that
/// plays back a scripted stream.
final chatServiceProvider = Provider<ChatService>((ref) => ChatService.instance);

/// The assistant's description, the credit meter and the input limits.
///
/// Kept alive between chats and updated in place: every finished reply carries
/// the meter's new reading, so the bar moves without a second request. It is
/// read again when the list opens, and whenever someone else signs in.
class ChatStatusNotifier extends AsyncNotifier<ChatStatus> {
  @override
  Future<ChatStatus> build() {
    ref.watch(currentUserProvider.select((user) => user?.id));
    return ref.watch(chatServiceProvider).status();
  }

  Future<void> refresh() async {
    final service = ref.read(chatServiceProvider);
    final next = await AsyncValue.guard(service.status);
    // A failed re-read keeps the last good meter rather than blanking the bar.
    if (!ref.mounted) return;
    if (next.hasValue || !state.hasValue) state = next;
  }

  void applyCredits(ChatCredits credits) {
    final current = state.value;
    if (current == null || !ref.mounted) return;
    state = AsyncData(current.withCredits(credits));
  }
}

final chatStatusProvider =
    AsyncNotifierProvider<ChatStatusNotifier, ChatStatus>(ChatStatusNotifier.new);

class ChatList {
  const ChatList({this.items = const [], this.page = 1, this.hasMore = false});

  final List<ChatConversation> items;
  final int page;
  final bool hasMore;
}

/// The reader's conversations, newest activity first.
class ChatListNotifier extends AsyncNotifier<ChatList> {
  bool _loadingMore = false;

  @override
  Future<ChatList> build() async {
    ref.watch(currentUserProvider.select((user) => user?.id));
    final page = await ref.watch(chatServiceProvider).conversations();
    return ChatList(items: page.items, page: page.page, hasMore: page.hasMore);
  }

  Future<void> refresh() async {
    final service = ref.read(chatServiceProvider);
    final next = await AsyncValue.guard(() async {
      final page = await service.conversations();
      return ChatList(items: page.items, page: page.page, hasMore: page.hasMore);
    });
    if (ref.mounted) state = next;
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || _loadingMore) return;
    _loadingMore = true;
    try {
      final page = await ref.read(chatServiceProvider).conversations(page: current.page + 1);
      if (!ref.mounted) return;
      state = AsyncData(ChatList(
        items: [...current.items, ...page.items],
        page: page.page,
        hasMore: page.hasMore,
      ));
    } finally {
      _loadingMore = false;
    }
  }

  /// Removed at once; put back if the server refuses, and the failure thrown.
  Future<void> delete(String id) async {
    final before = state.value;
    if (before == null) return;
    state = AsyncData(ChatList(
      items: before.items.where((item) => item.id != id).toList(),
      page: before.page,
      hasMore: before.hasMore,
    ));
    try {
      await ref.read(chatServiceProvider).delete(id);
    } catch (_) {
      if (ref.mounted) state = AsyncData(before);
      rethrow;
    }
  }

  Future<void> rename(String id, String title) async {
    final renamed = await ref.read(chatServiceProvider).rename(id, title);
    final current = state.value;
    if (current == null || !ref.mounted) return;
    state = AsyncData(ChatList(
      items: [for (final item in current.items) item.id == id ? item.copyWith(title: renamed.title) : item],
      page: current.page,
      hasMore: current.hasMore,
    ));
  }
}

final chatListProvider =
    AsyncNotifierProvider.autoDispose<ChatListNotifier, ChatList>(ChatListNotifier.new);
