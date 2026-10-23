import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/developer_chat_config.dart';
import '../models/developer_chat.dart';
import '../services/developer_chat_service.dart';
import '../services/live_socket.dart';

/// The service the chat talks through. A test replaces it.
final developerChatServiceProvider = Provider<DeveloperChatService>((ref) => DeveloperChatService.instance);

/// The line used by the chat screen. A test replaces it with one it drives.
final developerChatSocketProvider = Provider.autoDispose<LiveSocket>((ref) {
  final socket = LiveSocket();
  ref.onDispose(socket.dispose);
  return socket;
});

/// The conversation with the developer: the newest page, then each message as the server sends it, and what the
/// reader writes shown at once and confirmed behind it.
class DeveloperChatNotifier extends AsyncNotifier<DeveloperThread> {
  int _local = 0;

  @override
  Future<DeveloperThread> build() async {
    final socket = ref.watch(developerChatSocketProvider);
    final sub = socket.events.listen((event) {
      if (event.event == DeveloperChatConfig.messageEvent) _onLive(DeveloperMessage.fromJson(event.payload));
    });
    ref.onDispose(sub.cancel);
    socket.start();
    return ref.read(developerChatServiceProvider).thread();
  }

  void _onLive(DeveloperMessage incoming) {
    final current = state.value;
    if (current == null || current.messages.any((m) => m.id == incoming.id)) return;
    // The reader's own message comes back over the socket (to their other phones too); it replaces the local copy.
    final kept = incoming.fromDeveloper
        ? current.messages
        : current.messages.where((m) => !(m.pending && m.body == incoming.body)).toList();
    state = AsyncData(current.copyWith(messages: [...kept, incoming]));
    if (incoming.fromDeveloper) unawaited(_markRead());
  }

  Future<void> _markRead() async {
    try {
      await ref.read(developerChatServiceProvider).markRead();
      ref.invalidate(developerUnreadProvider);
    } catch (_) {
      // Corrected the next time the chat is opened.
    }
  }

  Future<void> loadOlder() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingOlder || current.messages.isEmpty) return;
    state = AsyncData(current.copyWith(loadingOlder: true));
    try {
      final page = await ref.read(developerChatServiceProvider).thread(before: current.messages.first.id);
      final latest = state.value ?? current;
      state = AsyncData(latest.copyWith(
        messages: [...page.messages, ...latest.messages],
        hasMore: page.hasMore,
        loadingOlder: false,
      ));
    } catch (_) {
      state = AsyncData((state.value ?? current).copyWith(loadingOlder: false));
      rethrow;
    }
  }

  Future<void> send(String body) async {
    final current = state.value;
    if (current == null) return;
    final local = DeveloperMessage(
      id: 'local-${_local++}',
      fromDeveloper: false,
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

  Future<void> _deliver(DeveloperMessage local) async {
    try {
      final saved = await ref.read(developerChatServiceProvider).send(local.body);
      final latest = state.value;
      if (latest == null) return;
      final already = latest.messages.any((m) => m.id == saved.id);
      // The socket may have delivered the saved copy first; then the local one just goes.
      final others = latest.messages.where((m) => m.id != local.id).toList();
      final index = latest.messages.indexWhere((m) => m.id == local.id);
      state = AsyncData(latest.copyWith(
        messages: already || index < 0 ? others : [...others.take(index), saved, ...others.skip(index)],
      ));
    } catch (_) {
      final latest = state.value;
      if (latest == null) return;
      state = AsyncData(latest.copyWith(messages: [
        for (final m in latest.messages) m.id == local.id ? m.copyWith(pending: false, failed: true) : m,
      ]));
    }
  }
}

final developerChatProvider =
    AsyncNotifierProvider.autoDispose<DeveloperChatNotifier, DeveloperThread>(DeveloperChatNotifier.new);

/// How many of the developer's replies are waiting — the dot on the Help screen's entry.
final developerUnreadProvider = FutureProvider.autoDispose<int>((ref) => ref.read(developerChatServiceProvider).unread());
