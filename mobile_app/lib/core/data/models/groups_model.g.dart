// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'groups_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$GroupModelImpl _$$GroupModelImplFromJson(Map<String, dynamic> json) =>
    _$GroupModelImpl(
      id: json['id'] as String,
      sampradayaId: json['sampradayaId'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      memberCount: (json['memberCount'] as num).toInt(),
      isActive: json['isActive'] as bool,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$$GroupModelImplToJson(_$GroupModelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'sampradayaId': instance.sampradayaId,
      'name': instance.name,
      'description': instance.description,
      'memberCount': instance.memberCount,
      'isActive': instance.isActive,
      'createdAt': instance.createdAt.toIso8601String(),
    };

_$GroupMemberModelImpl _$$GroupMemberModelImplFromJson(
  Map<String, dynamic> json,
) => _$GroupMemberModelImpl(
  id: json['id'] as String,
  groupId: json['groupId'] as String,
  userId: json['userId'] as String,
  role: json['role'] as String,
  joinedAt: DateTime.parse(json['joinedAt'] as String),
  lastReadAt: DateTime.parse(json['lastReadAt'] as String),
);

Map<String, dynamic> _$$GroupMemberModelImplToJson(
  _$GroupMemberModelImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'groupId': instance.groupId,
  'userId': instance.userId,
  'role': instance.role,
  'joinedAt': instance.joinedAt.toIso8601String(),
  'lastReadAt': instance.lastReadAt.toIso8601String(),
};

_$MessageModelImpl _$$MessageModelImplFromJson(Map<String, dynamic> json) =>
    _$MessageModelImpl(
      id: json['id'] as String,
      groupId: json['groupId'] as String,
      userId: json['userId'] as String,
      content: json['content'] as String,
      status: json['status'] as String,
      moderation: json['moderation'] == null
          ? null
          : ModerationModel.fromJson(
              json['moderation'] as Map<String, dynamic>,
            ),
      hiddenReason: json['hiddenReason'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$$MessageModelImplToJson(_$MessageModelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'groupId': instance.groupId,
      'userId': instance.userId,
      'content': instance.content,
      'status': instance.status,
      'moderation': instance.moderation,
      'hiddenReason': instance.hiddenReason,
      'createdAt': instance.createdAt.toIso8601String(),
    };

_$ModerationModelImpl _$$ModerationModelImplFromJson(
  Map<String, dynamic> json,
) => _$ModerationModelImpl(
  aiVerdict: json['aiVerdict'] as String,
  aiConfidence: (json['aiConfidence'] as num).toDouble(),
  aiReason: json['aiReason'] as String?,
  reviewedByAdmin: json['reviewedByAdmin'] as String?,
  reviewedAt: json['reviewedAt'] == null
      ? null
      : DateTime.parse(json['reviewedAt'] as String),
);

Map<String, dynamic> _$$ModerationModelImplToJson(
  _$ModerationModelImpl instance,
) => <String, dynamic>{
  'aiVerdict': instance.aiVerdict,
  'aiConfidence': instance.aiConfidence,
  'aiReason': instance.aiReason,
  'reviewedByAdmin': instance.reviewedByAdmin,
  'reviewedAt': instance.reviewedAt?.toIso8601String(),
};
