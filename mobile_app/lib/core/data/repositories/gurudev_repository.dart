import 'package:dio/dio.dart';
import 'package:hari_hari_bol/core/data/models/gurudev_model.dart';
import 'package:hari_hari_bol/core/data/repositories/base_repository.dart';
import 'package:hari_hari_bol/core/config/endpoints.dart';

abstract class GurudevRepository {
  Future<List<ChatbotSessionModel>> getChatbotSessions({int page = 1});
  Future<ChatbotSessionModel> createSession();
  Future<Map<String, dynamic>> getSession(String id);
  Future<ChatbotMessageModel> sendMessage(String sessionId, String content);
  Future<void> deleteSession(String id);
  Future<List<SuggestedPromptModel>> getSuggestedPrompts({String lang = 'en'});
}

class GurudevRepositoryImpl extends BaseRepository implements GurudevRepository {
  GurudevRepositoryImpl();

  @override
  Future<List<ChatbotSessionModel>> getChatbotSessions({int page = 1}) async {
    return handleRequest<List<ChatbotSessionModel>>(
      () => dio.get(Endpoints.chatbotSessions, queryParameters: {'page': page}),
      (data) => (data as List).map((e) => ChatbotSessionModel.fromJson(e)).toList(),
    );
  }

  @override
  Future<ChatbotSessionModel> createSession() async {
    return handleRequest<ChatbotSessionModel>(
      () => dio.post(Endpoints.chatbotSessions),
      (data) => ChatbotSessionModel.fromJson(data),
    );
  }

  @override
  Future<Map<String, dynamic>> getSession(String id) async {
    return handleRequest<Map<String, dynamic>>(
      () => dio.get(Endpoints.chatbotSession(id)),
      (data) => data,
    );
  }

  @override
  Future<ChatbotMessageModel> sendMessage(String sessionId, String content) async {
    return handleRequest<ChatbotMessageModel>(
      () => dio.post(Endpoints.sendChatbotMessage(sessionId), data: {'content': content}),
      (data) => ChatbotMessageModel.fromJson(data),
    );
  }

  @override
  Future<void> deleteSession(String id) async {
    return handleRequest<void>(
      () => dio.delete(Endpoints.chatbotSession(id)),
      (_) {},
    );
  }

  @override
  Future<List<SuggestedPromptModel>> getSuggestedPrompts({String lang = 'en'}) async {
    return handleRequest<List<SuggestedPromptModel>>(
      () => dio.get(Endpoints.suggestedPrompts, queryParameters: {'lang': lang}),
      (data) => (data as List).map((e) => SuggestedPromptModel.fromJson(e)).toList(),
    );
  }
}