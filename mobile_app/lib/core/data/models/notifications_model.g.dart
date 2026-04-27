// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notifications_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$NotificationPreferencesModelImpl _$$NotificationPreferencesModelImplFromJson(
  Map<String, dynamic> json,
) => _$NotificationPreferencesModelImpl(
  verseOfDay: json['verseOfDay'] as bool,
  newContent: json['newContent'] as bool,
  groupMessages: json['groupMessages'] as bool,
  guruDevUpdates: json['guruDevUpdates'] as bool,
  chantingReminders: json['chantingReminders'] as bool,
);

Map<String, dynamic> _$$NotificationPreferencesModelImplToJson(
  _$NotificationPreferencesModelImpl instance,
) => <String, dynamic>{
  'verseOfDay': instance.verseOfDay,
  'newContent': instance.newContent,
  'groupMessages': instance.groupMessages,
  'guruDevUpdates': instance.guruDevUpdates,
  'chantingReminders': instance.chantingReminders,
};
