import 'package:dio/dio.dart';
import 'package:hari_hari_bol/core/data/models/chanting_model.dart';
import 'package:hari_hari_bol/core/data/repositories/base_repository.dart';
import 'package:hari_hari_bol/core/config/endpoints.dart';

abstract class ChantingRepository {
  Future<void> logChant(String mantraId, int count, {int? durationSeconds});
  Future<ChantStatsModel> getChantStats(String range);
  Future<List<ChantLogModel>> getChantHistory({int page = 1, int limit = 20});
  Future<ChantStreakModel> getChantStreaks();
}

class ChantingRepositoryImpl extends BaseRepository implements ChantingRepository {
  ChantingRepositoryImpl();

  @override
  Future<void> logChant(String mantraId, int count, {int? durationSeconds}) async {
    final body = {
      'mantra_id': mantraId,
      'count': count,
      if (durationSeconds != null) 'duration_seconds': durationSeconds,
    };
    return handleRequest<void>(
      () => dio.post(Endpoints.chantingLog, data: body),
      (_) {},
    );
  }

  @override
  Future<ChantStatsModel> getChantStats(String range) async {
    return handleRequest<ChantStatsModel>(
      () => dio.get(Endpoints.chantingStats, queryParameters: {'range': range}),
      (data) => ChantStatsModel.fromJson(data),
    );
  }

  @override
  Future<List<ChantLogModel>> getChantHistory({int page = 1, int limit = 20}) async {
    return handleRequest<List<ChantLogModel>>(
      () => dio.get(Endpoints.chantingHistory, queryParameters: {'page': page, 'limit': limit}),
      (data) => (data as List).map((e) => ChantLogModel.fromJson(e)).toList(),
    );
  }

  @override
  Future<ChantStreakModel> getChantStreaks() async {
    return handleRequest<ChantStreakModel>(
      () => dio.get(Endpoints.chantingStreaks),
      (data) => ChantStreakModel.fromJson(data),
    );
  }
}