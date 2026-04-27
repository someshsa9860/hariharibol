import 'package:freezed_annotation/freezed_annotation.dart';

part 'gurudev_model.freezed.dart';
part 'gurudev_model.g.dart';

@freezed
class ChatbotSessionModel with _$ChatbotSessionModel {
  const factory ChatbotSessionModel({
    required String id,
    required String userId,
    required String title,
    required String guruPersonaUsed,
    required int messageCount,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _ChatbotSessionModel;

  factory ChatbotSessionModel.fromJson(Map<String, dynamic> json) =>
      _$ChatbotSessionModelFromJson(json);
}

@freezed
class ChatbotMessageModel with _$ChatbotMessageModel {
  const factory ChatbotMessageModel({
    required String id,
    required String sessionId,
    required String role,
    required String content,
    required List<CitationModel> citations,
    int? tokensUsed,
    required DateTime createdAt,
  }) = _ChatbotMessageModel;

  factory ChatbotMessageModel.fromJson(Map<String, dynamic> json) =>
      _$ChatbotMessageModelFromJson(json);
}

@freezed
class CitationModel with _$CitationModel {
  const factory CitationModel({
    required String verseId,
    required String excerpt,
  }) = _CitationModel;

  factory CitationModel.fromJson(Map<String, dynamic> json) =>
      _$CitationModelFromJson(json);
}

@freezed
class SuggestedPromptModel with _$SuggestedPromptModel {
  const factory SuggestedPromptModel({
    required String id,
    required String prompt,
    required String category,
  }) = _SuggestedPromptModel;

  factory SuggestedPromptModel.fromJson(Map<String, dynamic> json) =>
      _$SuggestedPromptModelFromJson(json);
}