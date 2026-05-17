import 'dart:convert';
import 'package:dio/dio.dart' as dio_lib;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/data/models/gurudev_model.dart';

final gurudevDioProvider = Provider((ref) => ApiClient.createDio());

final chatSessionsProvider = FutureProvider<List<ChatbotSessionModel>>((ref) async {
  final client = ref.watch(gurudevDioProvider);
  try {
    final response = await client.get('/api/v1/chatbot/sessions');
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => ChatbotSessionModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});

final suggestedPromptsProvider = Provider<List<String>>(
  (_) => const [
    'What is the meaning of the Gayatri Mantra?',
    'Explain karma and dharma',
    'How to begin a daily spiritual practice?',
    'What does the Gita say about meditation?',
    'Tell me about Lord Krishna\'s teachings',
    'How to find inner peace?',
  ],
);

class ChatMessage {
  final String id;
  final String role; // 'user' | 'assistant'
  final String content;
  final List<CitationModel> citations;
  final DateTime createdAt;

  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    this.citations = const [],
    required this.createdAt,
  });

  factory ChatMessage.fromModel(ChatbotMessageModel m) => ChatMessage(
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations,
        createdAt: m.createdAt,
      );

  factory ChatMessage.user(String content) => ChatMessage(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        role: 'user',
        content: content,
        createdAt: DateTime.now(),
      );
}

class ChatSessionState {
  final List<ChatMessage> messages;
  final bool isStreaming;
  final String streamingText;
  final bool isLoading;
  final String? error;
  final String? failedContent;

  const ChatSessionState({
    this.messages = const [],
    this.isStreaming = false,
    this.streamingText = '',
    this.isLoading = true,
    this.error,
    this.failedContent,
  });

  ChatSessionState copyWith({
    List<ChatMessage>? messages,
    bool? isStreaming,
    String? streamingText,
    bool? isLoading,
    String? error,
    String? failedContent,
    bool clearError = false,
    bool clearFailedContent = false,
  }) =>
      ChatSessionState(
        messages: messages ?? this.messages,
        isStreaming: isStreaming ?? this.isStreaming,
        streamingText: streamingText ?? this.streamingText,
        isLoading: isLoading ?? this.isLoading,
        error: clearError ? null : (error ?? this.error),
        failedContent: clearFailedContent ? null : (failedContent ?? this.failedContent),
      );
}

class ChatSessionNotifier extends StateNotifier<ChatSessionState> {
  final String sessionId;
  final dio_lib.Dio _client;

  ChatSessionNotifier(this.sessionId)
      : _client = ApiClient.createDio(),
        super(const ChatSessionState()) {
    _loadMessages();
  }

  Future<void> _loadMessages() async {
    try {
      final response =
          await _client.get('/api/v1/chatbot/sessions/$sessionId');
      final data = response.data['data'] ?? response.data;
      final rawMsgs = data['messages'] as List? ?? [];
      final msgs = rawMsgs
          .map((e) => ChatMessage.fromModel(
              ChatbotMessageModel.fromJson(e as Map<String, dynamic>)))
          .toList();
      state = state.copyWith(messages: msgs, isLoading: false);
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> sendMessage(String content) async {
    final trimmed = content.trim();
    if (trimmed.isEmpty) return;

    final userMsg = ChatMessage.user(trimmed);
    state = state.copyWith(
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamingText: '',
      clearError: true,
      clearFailedContent: true,
    );

    try {
      await _streamResponse(trimmed);
    } catch (_) {
      try {
        await _sendRegular(trimmed);
      } catch (e) {
        state = state.copyWith(
          isStreaming: false,
          streamingText: '',
          error: 'Failed to get a response. Tap retry to try again.',
          failedContent: trimmed,
        );
      }
    }
  }

  Future<void> retryLastMessage() async {
    final content = state.failedContent;
    if (content == null) return;
    // Remove the failed user message before retrying
    final msgs = [...state.messages];
    if (msgs.isNotEmpty && msgs.last.role == 'user') {
      msgs.removeLast();
    }
    state = state.copyWith(
      messages: msgs,
      clearError: true,
      clearFailedContent: true,
    );
    await sendMessage(content);
  }

  void clearConversation() {
    state = const ChatSessionState(isLoading: false);
  }

  Future<void> _streamResponse(String content) async {
    final response = await _client.post(
      '/api/v1/chatbot/sessions/$sessionId/messages',
      data: {'content': content, 'stream': true},
      options: dio_lib.Options(responseType: dio_lib.ResponseType.stream),
    );

    final responseBody = response.data as dio_lib.ResponseBody;
    final buffer = StringBuffer();
    List<CitationModel> citations = [];

    await for (final chunk in responseBody.stream) {
      final text = utf8.decode(chunk);
      for (final line in text.split('\n')) {
        final trimmedLine = line.trim();
        if (trimmedLine.startsWith('data: ')) {
          final payload = trimmedLine.substring(6).trim();
          if (payload == '[DONE]') continue;
          try {
            final json = jsonDecode(payload) as Map<String, dynamic>;
            final delta = json['delta'] as String? ??
                json['content'] as String? ?? '';
            if (delta.isNotEmpty) {
              buffer.write(delta);
              state = state.copyWith(streamingText: buffer.toString());
            }
            if (json['citations'] is List) {
              citations = (json['citations'] as List)
                  .map((c) =>
                      CitationModel.fromJson(c as Map<String, dynamic>))
                  .toList();
            }
          } catch (_) {
            buffer.write(payload);
            state = state.copyWith(streamingText: buffer.toString());
          }
        }
      }
    }

    final assistantMsg = ChatMessage(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      role: 'assistant',
      content: buffer.toString(),
      citations: citations,
      createdAt: DateTime.now(),
    );
    state = state.copyWith(
      messages: [...state.messages, assistantMsg],
      isStreaming: false,
      streamingText: '',
    );
  }

  Future<void> _sendRegular(String content) async {
    final response = await _client.post(
      '/api/v1/chatbot/sessions/$sessionId/messages',
      data: {'content': content},
    );
    final data = response.data['data'] ?? response.data;
    final msg =
        ChatbotMessageModel.fromJson(data as Map<String, dynamic>);
    state = state.copyWith(
      messages: [...state.messages, ChatMessage.fromModel(msg)],
      isStreaming: false,
      streamingText: '',
    );
  }
}

final chatSessionNotifierProvider =
    StateNotifierProvider.family<ChatSessionNotifier, ChatSessionState, String>(
  (ref, id) => ChatSessionNotifier(id),
);
