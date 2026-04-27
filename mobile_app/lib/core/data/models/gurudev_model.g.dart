// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gurudev_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ChatbotSessionModelImpl _$$ChatbotSessionModelImplFromJson(
  Map<String, dynamic> json,
) => _$ChatbotSessionModelImpl(
  id: json['id'] as String,
  userId: json['userId'] as String,
  title: json['title'] as String,
  guruPersonaUsed: json['guruPersonaUsed'] as String,
  messageCount: (json['messageCount'] as num).toInt(),
  createdAt: DateTime.parse(json['createdAt'] as String),
  updatedAt: DateTime.parse(json['updatedAt'] as String),
);

Map<String, dynamic> _$$ChatbotSessionModelImplToJson(
  _$ChatbotSessionModelImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'userId': instance.userId,
  'title': instance.title,
  'guruPersonaUsed': instance.guruPersonaUsed,
  'messageCount': instance.messageCount,
  'createdAt': instance.createdAt.toIso8601String(),
  'updatedAt': instance.updatedAt.toIso8601String(),
};

_$ChatbotMessageModelImpl _$$ChatbotMessageModelImplFromJson(
  Map<String, dynamic> json,
) => _$ChatbotMessageModelImpl(
  id: json['id'] as String,
  sessionId: json['sessionId'] as String,
  role: json['role'] as String,
  content: json['content'] as String,
  citations: (json['citations'] as List<dynamic>)
      .map((e) => CitationModel.fromJson(e as Map<String, dynamic>))
      .toList(),
  tokensUsed: (json['tokensUsed'] as num?)?.toInt(),
  createdAt: DateTime.parse(json['createdAt'] as String),
);

Map<String, dynamic> _$$ChatbotMessageModelImplToJson(
  _$ChatbotMessageModelImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'sessionId': instance.sessionId,
  'role': instance.role,
  'content': instance.content,
  'citations': instance.citations,
  'tokensUsed': instance.tokensUsed,
  'createdAt': instance.createdAt.toIso8601String(),
};

_$CitationModelImpl _$$CitationModelImplFromJson(Map<String, dynamic> json) =>
    _$CitationModelImpl(
      verseId: json['verseId'] as String,
      excerpt: json['excerpt'] as String,
    );

Map<String, dynamic> _$$CitationModelImplToJson(_$CitationModelImpl instance) =>
    <String, dynamic>{'verseId': instance.verseId, 'excerpt': instance.excerpt};

_$SuggestedPromptModelImpl _$$SuggestedPromptModelImplFromJson(
  Map<String, dynamic> json,
) => _$SuggestedPromptModelImpl(
  id: json['id'] as String,
  prompt: json['prompt'] as String,
  category: json['category'] as String,
);

Map<String, dynamic> _$$SuggestedPromptModelImplToJson(
  _$SuggestedPromptModelImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'prompt': instance.prompt,
  'category': instance.category,
};
