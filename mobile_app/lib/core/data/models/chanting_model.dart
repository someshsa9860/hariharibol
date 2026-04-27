import 'package:freezed_annotation/freezed_annotation.dart';

part 'chanting_model.freezed.dart';
part 'chanting_model.g.dart';

@freezed
class ChantLogModel with _$ChantLogModel {
  const factory ChantLogModel({
    required String id,
    required String userId,
    required String mantraId,
    required int count,
    int? durationSeconds,
    required DateTime date,
    required DateTime createdAt,
  }) = _ChantLogModel;

  factory ChantLogModel.fromJson(Map<String, dynamic> json) =>
      _$ChantLogModelFromJson(json);
}

@freezed
class ChantStatsModel with _$ChantStatsModel {
  const factory ChantStatsModel({
    required int totalChants,
    required int totalSessions,
    required int totalDurationSeconds,
    required int averageSessionChants,
    required Map<String, int> dailyStats, // date -> count
  }) = _ChantStatsModel;

  factory ChantStatsModel.fromJson(Map<String, dynamic> json) =>
      _$ChantStatsModelFromJson(json);
}

@freezed
class ChantStreakModel with _$ChantStreakModel {
  const factory ChantStreakModel({
    required int currentStreak,
    required int longestStreak,
    required DateTime lastChantDate,
  }) = _ChantStreakModel;

  factory ChantStreakModel.fromJson(Map<String, dynamic> json) =>
      _$ChantStreakModelFromJson(json);
}