import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/data/models/groups_model.dart';
import '../../../../features/home/data/models/verse_model.dart';
import '../../data/models/sampraday_detail_model.dart';

final _sampradayDioProvider = Provider((ref) => ApiClient.createDio());

final sampradayDetailProvider =
    FutureProvider.family<SampradayDetailModel, String>((ref, id) async {
  final dio = ref.watch(_sampradayDioProvider);
  final response = await dio.get('/api/v1/sampradayas/$id');
  return SampradayDetailModel.fromJson(
      response.data['data'] ?? response.data);
});

class SampradayFollowNotifier extends FamilyNotifier<bool, String> {
  @override
  bool build(String sampradayId) => false;

  Future<void> initialise(bool isFollowing) async {
    state = isFollowing;
  }

  Future<void> toggle() async {
    final dio = ref.read(_sampradayDioProvider);
    final nowFollowing = !state;
    state = nowFollowing;
    try {
      if (nowFollowing) {
        await dio.post('/api/v1/sampradayas/$arg/follow');
      } else {
        await dio.delete('/api/v1/sampradayas/$arg/follow');
      }
    } catch (_) {
      state = !nowFollowing;
    }
  }
}

final sampradayFollowProvider =
    NotifierProvider.family<SampradayFollowNotifier, bool, String>(
  SampradayFollowNotifier.new,
);

// Tracks the set of followed sampraday IDs across the listing page.
class SampradayaFollowSetNotifier extends Notifier<Set<String>> {
  @override
  Set<String> build() => {};

  void initialise(List<String> followedIds) {
    state = Set.from(followedIds);
  }

  Future<void> toggle(String sampradayId) async {
    final dio = ref.read(_sampradayDioProvider);
    final isFollowing = state.contains(sampradayId);
    state = isFollowing
        ? (Set.from(state)..remove(sampradayId))
        : (Set.from(state)..add(sampradayId));
    try {
      if (!isFollowing) {
        await dio.post('/api/v1/sampradayas/$sampradayId/follow');
      } else {
        await dio.delete('/api/v1/sampradayas/$sampradayId/follow');
      }
    } catch (_) {
      state = isFollowing
          ? (Set.from(state)..add(sampradayId))
          : (Set.from(state)..remove(sampradayId));
    }
  }
}

final sampradayaFollowSetProvider =
    NotifierProvider<SampradayaFollowSetNotifier, Set<String>>(
  SampradayaFollowSetNotifier.new,
);

final sampradayVersesProvider =
    FutureProvider.family<List<VerseModel>, String>((ref, sampradayId) async {
  final dio = ref.watch(_sampradayDioProvider);
  try {
    final response = await dio.get(
      '/api/v1/verses',
      queryParameters: {'sampradayaId': sampradayId, 'take': 20},
    );
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => VerseModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});

final sampradayGroupsProvider =
    FutureProvider.family<List<GroupModel>, String>((ref, sampradayId) async {
  final dio = ref.watch(_sampradayDioProvider);
  try {
    final response = await dio.get(
      '/api/v1/groups',
      queryParameters: {'sampradayaId': sampradayId},
    );
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => GroupModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});
