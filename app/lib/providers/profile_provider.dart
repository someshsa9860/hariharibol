import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/favorite.dart';
import '../models/user_summary.dart';
import '../services/favorite_service.dart';
import '../services/user_service.dart';

/// The counts on the profile screen. Cheap, and re-read whenever the screen is
/// opened rather than cached — a round chanted a minute ago should show.
final userSummaryProvider = FutureProvider.autoDispose<UserSummary>((ref) {
  return UserService.instance.summary();
});

/// Everything bookmarked, newest first.
final favoritesProvider = FutureProvider.autoDispose<List<Favorite>>((ref) {
  return FavoriteService.instance.list();
});
