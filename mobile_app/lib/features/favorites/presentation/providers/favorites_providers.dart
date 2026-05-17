import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/chanting/data/models/mantra_model.dart';
import '../../../../features/home/data/models/verse_detail_model.dart';
import '../../../../features/home/data/models/verse_model.dart';
import '../../../../features/home/presentation/providers/home_provider.dart';

// ─── Favorite Verses ──────────────────────────────────────────────────────────

final favoriteVersesProvider = FutureProvider<List<VerseModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get('/api/v1/users/me/favorites/verses');
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => VerseModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});

// ─── Favorite Mantras ─────────────────────────────────────────────────────────

final favoriteMantrasProvider =
    FutureProvider<List<MantraModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response = await dio.get('/api/v1/users/me/favorites/mantras');
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => MantraModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});

// ─── Favorite Narrations ──────────────────────────────────────────────────────

final favoriteNarrationsProvider =
    FutureProvider<List<NarrationModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final response =
        await dio.get('/api/v1/users/me/favorites/narrations');
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => NarrationModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});

// ─── Remove Verse Favorite ────────────────────────────────────────────────────

Future<void> removeVerseFavorite(Ref ref, String verseId) async {
  final dio = ref.read(dioProvider);
  await dio.delete('/api/v1/verses/$verseId/favorite');
  ref.invalidate(favoriteVersesProvider);
}

// ─── Remove Mantra Favorite ───────────────────────────────────────────────────

Future<void> removeMantraFavorite(Ref ref, String mantraId) async {
  final dio = ref.read(dioProvider);
  await dio.delete('/api/v1/mantras/$mantraId/favorite');
  ref.invalidate(favoriteMantrasProvider);
}
