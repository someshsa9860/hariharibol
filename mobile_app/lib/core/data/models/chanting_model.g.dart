// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'chanting_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ChantLogModelImpl _$$ChantLogModelImplFromJson(Map<String, dynamic> json) =>
    _$ChantLogModelImpl(
      id: json['id'] as String,
      userId: json['userId'] as String,
      mantraId: json['mantraId'] as String,
      count: (json['count'] as num).toInt(),
      durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
      date: DateTime.parse(json['date'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$$ChantLogModelImplToJson(_$ChantLogModelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'userId': instance.userId,
      'mantraId': instance.mantraId,
      'count': instance.count,
      'durationSeconds': instance.durationSeconds,
      'date': instance.date.toIso8601String(),
      'createdAt': instance.createdAt.toIso8601String(),
    };

_$ChantStatsModelImpl _$$ChantStatsModelImplFromJson(
  Map<String, dynamic> json,
) => _$ChantStatsModelImpl(
  totalChants: (json['totalChants'] as num).toInt(),
  totalSessions: (json['totalSessions'] as num).toInt(),
  totalDurationSeconds: (json['totalDurationSeconds'] as num).toInt(),
  averageSessionChants: (json['averageSessionChants'] as num).toInt(),
  dailyStats: Map<String, int>.from(json['dailyStats'] as Map),
);

Map<String, dynamic> _$$ChantStatsModelImplToJson(
  _$ChantStatsModelImpl instance,
) => <String, dynamic>{
  'totalChants': instance.totalChants,
  'totalSessions': instance.totalSessions,
  'totalDurationSeconds': instance.totalDurationSeconds,
  'averageSessionChants': instance.averageSessionChants,
  'dailyStats': instance.dailyStats,
};

_$ChantStreakModelImpl _$$ChantStreakModelImplFromJson(
  Map<String, dynamic> json,
) => _$ChantStreakModelImpl(
  currentStreak: (json['currentStreak'] as num).toInt(),
  longestStreak: (json['longestStreak'] as num).toInt(),
  lastChantDate: DateTime.parse(json['lastChantDate'] as String),
);

Map<String, dynamic> _$$ChantStreakModelImplToJson(
  _$ChantStreakModelImpl instance,
) => <String, dynamic>{
  'currentStreak': instance.currentStreak,
  'longestStreak': instance.longestStreak,
  'lastChantDate': instance.lastChantDate.toIso8601String(),
};
