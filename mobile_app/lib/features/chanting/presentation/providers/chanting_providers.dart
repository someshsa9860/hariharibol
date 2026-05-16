import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive/hive.dart';

import '../../../../core/data/models/chanting_model.dart';
import '../../../../features/home/presentation/providers/home_provider.dart';
import '../../data/models/mantra_model.dart';
import '../../../../features/home/data/models/sampraday_model.dart';

// ─── Mantra Detail ────────────────────────────────────────────────────────────

final mantraDetailProvider =
    FutureProvider.family<MantraModel, String>((ref, id) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get('/api/v1/mantras/$id');
  final data = response.data['data'] ?? response.data;
  return MantraModel.fromJson(data as Map<String, dynamic>);
});

// ─── Sampraday Mantras ────────────────────────────────────────────────────────

final sampradayMantrasProvider =
    FutureProvider.family<List<MantraModel>, String>((ref, sampradayId) async {
  final dio = ref.watch(dioProvider);
  final response =
      await dio.get('/api/v1/sampradayas/$sampradayId/mantras');
  final data = response.data['data'] ?? response.data;
  if (data is List) {
    return data
        .map((e) => MantraModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
  return [];
});

// ─── Chanting Stats (today) ───────────────────────────────────────────────────

final chantingStatsProvider = FutureProvider<ChantStatsModel>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get('/api/v1/chanting/stats');
    final data = response.data['data'] ?? response.data;
    return ChantStatsModel.fromJson(data as Map<String, dynamic>);
  } catch (_) {
    return const ChantStatsModel(
      totalChants: 0,
      totalSessions: 0,
      totalDurationSeconds: 0,
      averageSessionChants: 0,
      dailyStats: {},
    );
  }
});

// ─── Chanting Streak ──────────────────────────────────────────────────────────

final chantingStreakProvider = FutureProvider<ChantStreakModel>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get('/api/v1/chanting/streaks');
    final data = response.data['data'] ?? response.data;
    return ChantStreakModel.fromJson(data as Map<String, dynamic>);
  } catch (_) {
    return ChantStreakModel(
      currentStreak: 0,
      longestStreak: 0,
      lastChantDate: DateTime.now(),
    );
  }
});

// ─── Chant History ────────────────────────────────────────────────────────────

final chantHistoryProvider =
    FutureProvider.family<List<ChantLogModel>, String>((ref, period) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get(
      '/api/v1/chanting/history',
      queryParameters: {'period': period},
    );
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => ChantLogModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});

// ─── Today's chanting total ───────────────────────────────────────────────────

final todayChantCountProvider = FutureProvider<int>((ref) async {
  final stats = await ref.watch(chantingStatsProvider.future);
  final today = _dateKey(DateTime.now());
  return stats.dailyStats[today] ?? 0;
});

String _dateKey(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

// ─── Last-used mantra (in-memory, survives tab switches) ──────────────────────

final lastUsedMantraProvider = StateProvider<MantraModel?>((ref) => null);

// ─── Chant Counter State ──────────────────────────────────────────────────────

@immutable
class ChantCounterState {
  final String mantraId;
  final String mantraName;
  final int count;
  final int goal;
  final bool isPaused;
  final DateTime startTime;

  const ChantCounterState({
    required this.mantraId,
    required this.mantraName,
    required this.count,
    required this.goal,
    required this.isPaused,
    required this.startTime,
  });

  ChantCounterState copyWith({
    String? mantraId,
    String? mantraName,
    int? count,
    int? goal,
    bool? isPaused,
    DateTime? startTime,
  }) {
    return ChantCounterState(
      mantraId: mantraId ?? this.mantraId,
      mantraName: mantraName ?? this.mantraName,
      count: count ?? this.count,
      goal: goal ?? this.goal,
      isPaused: isPaused ?? this.isPaused,
      startTime: startTime ?? this.startTime,
    );
  }
}

// ─── ChantParams — family key ─────────────────────────────────────────────────

@immutable
class ChantParams {
  final String mantraId;
  final String mantraName;
  final int goal;

  const ChantParams({
    required this.mantraId,
    required this.mantraName,
    required this.goal,
  });

  @override
  bool operator ==(Object other) =>
      other is ChantParams && mantraId == other.mantraId;

  @override
  int get hashCode => mantraId.hashCode;
}

// ─── Notifier ─────────────────────────────────────────────────────────────────

class ChantCounterNotifier extends StateNotifier<ChantCounterState> {
  final Dio _dio;
  Box<int>? _box;
  static const _boxName = 'chant_counter';

  ChantCounterNotifier(this._dio, ChantParams params)
      : super(ChantCounterState(
          mantraId: params.mantraId,
          mantraName: params.mantraName,
          count: 0,
          goal: params.goal,
          isPaused: false,
          startTime: DateTime.now(),
        )) {
    _openBox();
  }

  Future<void> _openBox() async {
    _box = await Hive.openBox<int>(_boxName);
    final saved = _box!.get('count_${state.mantraId}') ?? 0;
    if (saved > 0 && mounted) {
      state = state.copyWith(count: saved);
    }
  }

  void increment() {
    if (state.isPaused) return;
    final next = state.count + 1;
    state = state.copyWith(count: next);
    if (next % 10 == 0) _autoSave();
  }

  void togglePause() {
    state = state.copyWith(isPaused: !state.isPaused);
  }

  void reset() {
    state = state.copyWith(count: 0, isPaused: false);
    _box?.delete('count_${state.mantraId}');
  }

  void _autoSave() {
    _box?.put('count_${state.mantraId}', state.count);
  }

  Future<bool> done() async {
    final secs = DateTime.now().difference(state.startTime).inSeconds;
    try {
      await _dio.post('/api/v1/chanting/log', data: {
        'mantraId': state.mantraId,
        'count': state.count,
        'durationSeconds': secs,
        'date': DateTime.now().toIso8601String(),
      });
      _box?.delete('count_${state.mantraId}');
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

final chantCounterProvider = StateNotifierProvider.family<
    ChantCounterNotifier, ChantCounterState, ChantParams>(
  (ref, params) {
    final dio = ref.watch(dioProvider);
    return ChantCounterNotifier(dio, params);
  },
);

// ─── All sampradayas for chanting grid ────────────────────────────────────────

final chantingSampradayListProvider =
    FutureProvider<List<SampradayModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get('/api/v1/sampradayas');
  final data = response.data['data'] ?? response.data;
  if (data is List) {
    return data
        .map((e) => SampradayModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
  return [];
});

final chantingFollowedSampradayIdsProvider =
    FutureProvider<Set<String>>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get('/api/v1/sampradayas/me/followed');
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => (e as Map<String, dynamic>)['id'] as String)
          .toSet();
    }
  } catch (_) {}
  return {};
});

// ─── Weekly chant logs (last 7 for bar chart) ─────────────────────────────────

final weeklyChantLogsProvider =
    FutureProvider<List<ChantLogModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get(
      '/api/v1/chanting/logs',
      queryParameters: {'limit': '7'},
    );
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => ChantLogModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});
