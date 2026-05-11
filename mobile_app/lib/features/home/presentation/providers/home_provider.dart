import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../home/data/models/verse_model.dart';
import '../../../home/data/models/sampraday_model.dart';
import '../../../home/data/models/verse_detail_model.dart';

final dioProvider = Provider((ref) => ApiClient.createDio());

final verseOfDayProvider = FutureProvider<VerseModel>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get('/api/v1/verses/of-day');
  return VerseModel.fromJson(response.data['data'] ?? response.data);
});

final sampradayListProvider = FutureProvider<List<SampradayModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get('/api/v1/sampradayas');
  final data = response.data['data'] ?? response.data;
  if (data is List) {
    return data.map((e) => SampradayModel.fromJson(e)).toList();
  }
  return [];
});

final followedSampradayListProvider =
    FutureProvider<List<SampradayModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get('/api/v1/sampradayas/me/followed');
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data.map((e) => SampradayModel.fromJson(e)).toList();
    }
  } catch (_) {
    return [];
  }
  return [];
});

final randomVerseProvider = FutureProvider<VerseModel>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get('/api/v1/verses/random');
  return VerseModel.fromJson(response.data['data'] ?? response.data);
});

final versesByCategoryProvider =
    FutureProvider.family<List<VerseModel>, String>((ref, category) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get(
    '/api/v1/verses',
    queryParameters: {'category': category, 'take': 10},
  );
  final data = response.data['data'] ?? response.data;
  if (data is List) {
    return data.map((e) => VerseModel.fromJson(e)).toList();
  }
  return [];
});

final verseDetailProvider =
    FutureProvider.family<VerseDetailModel, String>((ref, verseId) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get('/api/v1/verses/$verseId');
  return VerseDetailModel.fromJson(response.data['data'] ?? response.data);
});

final todayWisdomProvider = FutureProvider<NarrationModel?>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response =
        await dio.get('/api/v1/narrations', queryParameters: {'take': 1});
    final data = response.data['data'] ?? response.data;
    if (data is List && data.isNotEmpty) {
      return NarrationModel.fromJson(data.first as Map<String, dynamic>);
    }
  } catch (_) {
    return null;
  }
  return null;
});
