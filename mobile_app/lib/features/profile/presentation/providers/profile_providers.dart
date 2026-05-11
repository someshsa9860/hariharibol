import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../home/data/models/sampraday_model.dart';
import '../../../home/data/models/verse_model.dart';
import '../../../home/presentation/providers/home_provider.dart';

class ProfileData {
  final String id;
  final String name;
  final String? email;
  final String? avatarUrl;
  final DateTime? joinedAt;
  final int favoritesCount;
  final int totalChants;
  final int currentStreak;
  final int followedSampradayasCount;

  const ProfileData({
    required this.id,
    required this.name,
    this.email,
    this.avatarUrl,
    this.joinedAt,
    this.favoritesCount = 0,
    this.totalChants = 0,
    this.currentStreak = 0,
    this.followedSampradayasCount = 0,
  });

  factory ProfileData.fromJson(Map<String, dynamic> json) {
    return ProfileData(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Devotee',
      email: json['email'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      joinedAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
      favoritesCount: json['favoritesCount'] as int? ?? 0,
      totalChants: json['totalChants'] as int? ?? 0,
      currentStreak: json['currentStreak'] as int? ?? 0,
      followedSampradayasCount:
          json['followedSampradayasCount'] as int? ?? 0,
    );
  }

  ProfileData copyWith({
    String? name,
    String? email,
    String? avatarUrl,
    DateTime? joinedAt,
    int? favoritesCount,
    int? totalChants,
    int? currentStreak,
    int? followedSampradayasCount,
  }) =>
      ProfileData(
        id: id,
        name: name ?? this.name,
        email: email ?? this.email,
        avatarUrl: avatarUrl ?? this.avatarUrl,
        joinedAt: joinedAt ?? this.joinedAt,
        favoritesCount: favoritesCount ?? this.favoritesCount,
        totalChants: totalChants ?? this.totalChants,
        currentStreak: currentStreak ?? this.currentStreak,
        followedSampradayasCount:
            followedSampradayasCount ?? this.followedSampradayasCount,
      );
}

final profileProvider = FutureProvider<ProfileData>((ref) async {
  final client = ref.watch(dioProvider);

  final userResponse = await client.get('/api/v1/users/me');
  final userData = userResponse.data['data'] ?? userResponse.data;
  var profile = ProfileData.fromJson(userData as Map<String, dynamic>);

  int totalChants = profile.totalChants;
  int currentStreak = profile.currentStreak;
  int favoritesCount = profile.favoritesCount;
  int followedCount = profile.followedSampradayasCount;

  try {
    final r = await client.get('/api/v1/chanting/stats');
    final d = r.data['data'] ?? r.data;
    totalChants =
        (d as Map<String, dynamic>)['totalChants'] as int? ?? totalChants;
  } catch (_) {}

  try {
    final r = await client.get('/api/v1/chanting/streaks');
    final d = r.data['data'] ?? r.data;
    currentStreak =
        (d as Map<String, dynamic>)['currentStreak'] as int? ?? currentStreak;
  } catch (_) {}

  try {
    final r = await client
        .get('/api/v1/favorites', queryParameters: {'take': 1});
    favoritesCount = r.data['total'] as int? ?? favoritesCount;
  } catch (_) {}

  try {
    final r = await client.get('/api/v1/sampradayas/me/followed');
    final list = r.data['data'] ?? r.data;
    if (list is List) followedCount = list.length;
  } catch (_) {}

  return profile.copyWith(
    totalChants: totalChants,
    currentStreak: currentStreak,
    favoritesCount: favoritesCount,
    followedSampradayasCount: followedCount,
  );
});

final profileFollowedSampradayasProvider =
    FutureProvider<List<SampradayModel>>((ref) async {
  final client = ref.watch(dioProvider);
  try {
    final response = await client.get('/api/v1/sampradayas/me/followed');
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => SampradayModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});

final profileFavoriteVersesProvider =
    FutureProvider<List<VerseModel>>((ref) async {
  final client = ref.watch(dioProvider);
  try {
    final response =
        await client.get('/api/v1/favorites', queryParameters: {'take': 6});
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data
          .map((e) => VerseModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  } catch (_) {}
  return [];
});
