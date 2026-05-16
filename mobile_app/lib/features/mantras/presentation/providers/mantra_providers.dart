import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../../../features/chanting/data/models/mantra_model.dart';
import '../../../../features/home/presentation/providers/home_provider.dart';

// ─── Mantras list ─────────────────────────────────────────────────────────────
final mantrasListProvider = FutureProvider<List<MantraModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get('/api/v1/mantras');
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => MantraModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});

// ─── Search + category state ──────────────────────────────────────────────────
final mantraSearchProvider = StateProvider<String>((ref) => '');
final mantraSelectedCategoryProvider = StateProvider<String?>((ref) => null);

// ─── Filtered mantras ─────────────────────────────────────────────────────────
final filteredMantrasProvider =
    Provider<AsyncValue<List<MantraModel>>>((ref) {
  final mantrasAsync = ref.watch(mantrasListProvider);
  final search = ref.watch(mantraSearchProvider).toLowerCase().trim();
  final category = ref.watch(mantraSelectedCategoryProvider);

  return mantrasAsync.whenData((mantras) {
    return mantras.where((m) {
      final matchSearch = search.isEmpty ||
          m.name.toLowerCase().contains(search) ||
          (m.meaning?.toLowerCase().contains(search) ?? false) ||
          (m.sampradayName?.toLowerCase().contains(search) ?? false);
      final matchCategory = category == null ||
          category == 'all' ||
          (m.category?.toLowerCase() == category.toLowerCase());
      return matchSearch && matchCategory;
    }).toList();
  });
});

// ─── Favorite IDs (optimistic local state) ────────────────────────────────────
final mantraFavoriteIdsProvider =
    StateProvider<Set<String>>((ref) => const {});

// ─── Audio Player State ───────────────────────────────────────────────────────
class MantraAudioState {
  final String? mantraId;
  final String? mantraName;
  final bool isPlaying;
  final Duration position;
  final Duration duration;

  const MantraAudioState({
    this.mantraId,
    this.mantraName,
    this.isPlaying = false,
    this.position = Duration.zero,
    this.duration = Duration.zero,
  });

  bool get hasTrack => mantraId != null;

  MantraAudioState copyWith({
    String? mantraId,
    String? mantraName,
    bool? isPlaying,
    Duration? position,
    Duration? duration,
  }) =>
      MantraAudioState(
        mantraId: mantraId ?? this.mantraId,
        mantraName: mantraName ?? this.mantraName,
        isPlaying: isPlaying ?? this.isPlaying,
        position: position ?? this.position,
        duration: duration ?? this.duration,
      );
}

// ─── Audio Notifier ───────────────────────────────────────────────────────────
class MantraAudioNotifier extends StateNotifier<MantraAudioState> {
  final AudioPlayer _player = AudioPlayer();

  MantraAudioNotifier() : super(const MantraAudioState()) {
    _player.playerStateStream.listen((s) {
      if (!mounted) return;
      state = state.copyWith(isPlaying: s.playing);
    });
    _player.positionStream.listen((pos) {
      if (!mounted) return;
      state = state.copyWith(position: pos);
    });
    _player.durationStream.listen((dur) {
      if (!mounted) return;
      state = state.copyWith(duration: dur ?? Duration.zero);
    });
  }

  Future<void> play(String id, String name, String url) async {
    if (state.mantraId == id) {
      state.isPlaying ? await _player.pause() : await _player.play();
      return;
    }
    state = MantraAudioState(mantraId: id, mantraName: name);
    try {
      await _player.setUrl(url);
      await _player.play();
    } catch (_) {
      state = const MantraAudioState();
    }
  }

  Future<void> pause() => _player.pause();
  Future<void> resume() => _player.play();
  Future<void> seek(Duration pos) => _player.seek(pos);

  Future<void> stop() async {
    await _player.stop();
    if (mounted) state = const MantraAudioState();
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }
}

final mantraAudioProvider =
    StateNotifierProvider<MantraAudioNotifier, MantraAudioState>(
  (ref) => MantraAudioNotifier(),
);
