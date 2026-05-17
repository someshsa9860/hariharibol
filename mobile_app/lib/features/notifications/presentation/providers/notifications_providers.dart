import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/home/presentation/providers/home_provider.dart';
import '../../data/models/in_app_notification_model.dart';

// ─── State ────────────────────────────────────────────────────────────────────

class NotificationsState {
  final List<InAppNotificationModel> notifications;
  final bool isLoading;
  final String? error;

  const NotificationsState({
    this.notifications = const [],
    this.isLoading = false,
    this.error,
  });

  int get unreadCount => notifications.where((n) => !n.isRead).length;

  NotificationsState copyWith({
    List<InAppNotificationModel>? notifications,
    bool? isLoading,
    String? error,
  }) =>
      NotificationsState(
        notifications: notifications ?? this.notifications,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

// ─── Notifier ─────────────────────────────────────────────────────────────────

class NotificationsNotifier extends StateNotifier<NotificationsState> {
  final Ref _ref;

  NotificationsNotifier(this._ref) : super(const NotificationsState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final dio = _ref.read(dioProvider);
      final response = await dio.get('/api/v1/notifications');
      final data = response.data['data'] ?? response.data;
      final list = <InAppNotificationModel>[];
      if (data is List) {
        for (final e in data) {
          list.add(
              InAppNotificationModel.fromJson(e as Map<String, dynamic>));
        }
      }
      state = state.copyWith(notifications: list, isLoading: false);
    } catch (_) {
      state = state.copyWith(
          isLoading: false, error: 'Failed to load notifications');
    }
  }

  Future<void> markRead(String id) async {
    try {
      final dio = _ref.read(dioProvider);
      await dio.patch('/api/v1/notifications/$id/read');
      final updated =
          state.notifications.map((n) => n.id == id ? n.copyWith(isRead: true) : n).toList();
      state = state.copyWith(notifications: updated);
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    try {
      final dio = _ref.read(dioProvider);
      await dio.patch('/api/v1/notifications/read-all');
      final updated =
          state.notifications.map((n) => n.copyWith(isRead: true)).toList();
      state = state.copyWith(notifications: updated);
    } catch (_) {}
  }
}

// ─── Providers ────────────────────────────────────────────────────────────────

final notificationsProvider =
    StateNotifierProvider<NotificationsNotifier, NotificationsState>(
  (ref) => NotificationsNotifier(ref),
);

final unreadNotificationCountProvider = Provider<int>((ref) {
  return ref.watch(notificationsProvider).unreadCount;
});
