import 'package:freezed_annotation/freezed_annotation.dart';

part 'groups_model.freezed.dart';
part 'groups_model.g.dart';

@freezed
class GroupModel with _$GroupModel {
  const factory GroupModel({
    required String id,
    required String sampradayaId,
    required String name,
    required String description,
    required int memberCount,
    required bool isActive,
    required DateTime createdAt,
  }) = _GroupModel;

  factory GroupModel.fromJson(Map<String, dynamic> json) =>
      _$GroupModelFromJson(json);
}

@freezed
class GroupMemberModel with _$GroupMemberModel {
  const factory GroupMemberModel({
    required String id,
    required String groupId,
    required String userId,
    required String role,
    required DateTime joinedAt,
    required DateTime lastReadAt,
  }) = _GroupMemberModel;

  factory GroupMemberModel.fromJson(Map<String, dynamic> json) =>
      _$GroupMemberModelFromJson(json);
}

@freezed
class MessageModel with _$MessageModel {
  const factory MessageModel({
    required String id,
    required String groupId,
    required String userId,
    required String content,
    required String status,
    ModerationModel? moderation,
    String? hiddenReason,
    required DateTime createdAt,
  }) = _MessageModel;

  factory MessageModel.fromJson(Map<String, dynamic> json) =>
      _$MessageModelFromJson(json);
}

@freezed
class ModerationModel with _$ModerationModel {
  const factory ModerationModel({
    required String aiVerdict,
    required double aiConfidence,
    String? aiReason,
    String? reviewedByAdmin,
    DateTime? reviewedAt,
  }) = _ModerationModel;

  factory ModerationModel.fromJson(Map<String, dynamic> json) =>
      _$ModerationModelFromJson(json);
}