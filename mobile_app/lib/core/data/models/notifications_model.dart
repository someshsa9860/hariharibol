import 'package:freezed_annotation/freezed_annotation.dart';

part 'notifications_model.freezed.dart';
part 'notifications_model.g.dart';

@freezed
class NotificationPreferencesModel with _$NotificationPreferencesModel {
  const factory NotificationPreferencesModel({
    required bool verseOfDay,
    required bool newContent,
    required bool groupMessages,
    required bool guruDevUpdates,
    required bool chantingReminders,
  }) = _NotificationPreferencesModel;

  factory NotificationPreferencesModel.fromJson(Map<String, dynamic> json) =>
      _$NotificationPreferencesModelFromJson(json);
}