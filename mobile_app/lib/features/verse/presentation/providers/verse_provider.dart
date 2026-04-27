import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../../../home/data/models/verse_model.dart';

final dioProvider = Provider((ref) => ApiClient.createDio());

final verseDetailProvider = FutureProvider.family<VerseModel, String>((ref, verseId) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get('/api/v1/verses/$verseId');
  return VerseModel.fromJson(response.data['data'] ?? response.data);
});
