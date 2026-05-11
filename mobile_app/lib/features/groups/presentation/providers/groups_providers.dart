import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/data/models/groups_model.dart';

final groupsDioProvider = Provider((ref) => ApiClient.createDio());

final myGroupsProvider = FutureProvider<List<GroupModel>>((ref) async {
  final client = ref.watch(groupsDioProvider);
  try {
    final response = await client.get('/api/v1/groups/me');
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => GroupModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});

final groupDetailProvider =
    FutureProvider.family<GroupModel, String>((ref, id) async {
  final client = ref.watch(groupsDioProvider);
  final response = await client.get('/api/v1/groups/$id');
  final data = response.data['data'] ?? response.data;
  return GroupModel.fromJson(data as Map<String, dynamic>);
});

class GroupChatState {
  final List<MessageModel> messages;
  final bool isConnected;
  final bool isSending;
  final List<GroupMemberModel> members;

  const GroupChatState({
    this.messages = const [],
    this.isConnected = false,
    this.isSending = false,
    this.members = const [],
  });

  GroupChatState copyWith({
    List<MessageModel>? messages,
    bool? isConnected,
    bool? isSending,
    List<GroupMemberModel>? members,
  }) =>
      GroupChatState(
        messages: messages ?? this.messages,
        isConnected: isConnected ?? this.isConnected,
        isSending: isSending ?? this.isSending,
        members: members ?? this.members,
      );
}

class GroupChatNotifier extends StateNotifier<GroupChatState> {
  final String groupId;
  final _client = ApiClient.createDio();

  GroupChatNotifier(this.groupId) : super(const GroupChatState()) {
    _loadMessages();
  }

  Future<void> _loadMessages() async {
    try {
      final response =
          await _client.get('/api/v1/groups/$groupId/messages');
      final data = response.data['data'] ?? response.data;
      if (data is List) {
        final msgs = data
            .map((e) =>
                MessageModel.fromJson(e as Map<String, dynamic>))
            .toList();
        state = state.copyWith(messages: msgs);
      }
    } catch (_) {}
  }

  Future<void> sendMessage(String content) async {
    if (content.trim().isEmpty) return;
    state = state.copyWith(isSending: true);

    // Optimistic update with a temp message
    final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
    final tempMsg = MessageModel(
      id: tempId,
      groupId: groupId,
      userId: '__me__',
      content: content.trim(),
      status: 'sending',
      createdAt: DateTime.now(),
    );
    state = state.copyWith(messages: [...state.messages, tempMsg]);

    try {
      final response = await _client.post(
        '/api/v1/groups/$groupId/messages',
        data: {'content': content.trim()},
      );
      final data = response.data['data'] ?? response.data;
      final sent =
          MessageModel.fromJson(data as Map<String, dynamic>);
      final updated = state.messages
          .map((m) => m.id == tempId ? sent : m)
          .toList();
      state = state.copyWith(messages: updated, isSending: false);
    } catch (_) {
      // Remove failed optimistic message
      final filtered =
          state.messages.where((m) => m.id != tempId).toList();
      state = state.copyWith(messages: filtered, isSending: false);
    }
  }

  Future<void> reportMessage(String messageId) async {
    try {
      await _client.post(
          '/api/v1/groups/$groupId/messages/$messageId/report');
    } catch (_) {}
  }

  void addSocketMessage(MessageModel msg) {
    if (state.messages.any((m) => m.id == msg.id)) return;
    state = state.copyWith(messages: [...state.messages, msg]);
  }

  void setConnected(bool connected) =>
      state = state.copyWith(isConnected: connected);
}

final groupChatNotifierProvider =
    StateNotifierProvider.family<GroupChatNotifier, GroupChatState, String>(
  (ref, id) => GroupChatNotifier(id),
);
