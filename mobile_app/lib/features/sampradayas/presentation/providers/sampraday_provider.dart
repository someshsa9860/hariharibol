import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../data/models/sampraday_detail_model.dart';

final _sampradayDioProvider = Provider((ref) => ApiClient.createDio());

final sampradayDetailProvider =
    FutureProvider.family<SampradayDetailModel, String>((ref, id) async {
  final dio = ref.watch(_sampradayDioProvider);
  final response = await dio.get('/api/v1/sampradayas/$id');
  return SampradayDetailModel.fromJson(
      response.data['data'] ?? response.data);
});

// Notifier that manages follow state and syncs with the server.
class SampradayFollowNotifier
    extends FamilyNotifier<bool, String> {
  @override
  bool build(String sampradayId) => false;

  Future<void> initialise(bool isFollowing) async {
    state = isFollowing;
  }

  Future<void> toggle() async {
    final dio = ref.read(_sampradayDioProvider);
    final nowFollowing = !state;
    state = nowFollowing; // optimistic update
    try {
      if (nowFollowing) {
        await dio.post('/api/v1/sampradayas/$arg/follow');
      } else {
        await dio.delete('/api/v1/sampradayas/$arg/follow');
      }
    } catch (_) {
      state = !nowFollowing; // revert on error
    }
  }
}

final sampradayFollowProvider =
    NotifierProvider.family<SampradayFollowNotifier, bool, String>(
  SampradayFollowNotifier.new,
);
