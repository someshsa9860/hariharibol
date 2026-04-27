import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/config/endpoints.dart';
import '../../../home/data/models/verse_model.dart';
import '../../../home/data/models/sampraday_model.dart';

final dioProvider = Provider((ref) => ApiClient.createDio());

final verseOfDayProvider = FutureProvider<VerseModel>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get(Endpoints.verseOfDay);
  return VerseModel.fromJson(response.data['data'] ?? response.data);
});

final sampradayListProvider = FutureProvider<List<SampradayModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get(Endpoints.sampradayas);
  final data = response.data['data'] ?? response.data;
  if (data is List) {
    return data.map((e) => SampradayModel.fromJson(e)).toList();
  }
  return [];
});

final followedSampradayListProvider = FutureProvider<List<SampradayModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get('/api/v1/sampradayas/me/followed');
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data.map((e) => SampradayModel.fromJson(e)).toList();
    }
  } catch (e) {
    // User not authenticated or no followed sampradayas
    return [];
  }
  return [];
});

final randomVerseProvider = FutureProvider<VerseModel>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get(Endpoints.randomVerse);
  return VerseModel.fromJson(response.data['data'] ?? response.data);
});
