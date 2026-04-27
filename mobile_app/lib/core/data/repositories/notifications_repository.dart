import 'package:dio/dio.dart';
import 'package:hari_hari_bol/core/data/models/notifications_model.dart';
import 'package:hari_hari_bol/core/data/repositories/base_repository.dart';
import 'package:hari_hari_bol/core/config/endpoints.dart';

abstract class NotificationsRepository {
  Future<void> registerDeviceToken(String token, String platform);
  Future<void> updateNotificationPreferences(NotificationPreferencesModel preferences);
  Future<NotificationPreferencesModel> getNotificationPreferences();
}

class NotificationsRepositoryImpl extends BaseRepository implements NotificationsRepository {
  NotificationsRepositoryImpl();

  @override
  Future<void> registerDeviceToken(String token, String platform) async {
    return handleRequest<void>(
      () => dio.post(Endpoints.registerDeviceToken, data: {
        'token': token,
        'platform': platform,
      }),
      (_) {},
    );
  }

  @override
  Future<void> updateNotificationPreferences(NotificationPreferencesModel preferences) async {
    return handleRequest<void>(
      () => dio.put(Endpoints.notificationPreferences, data: preferences.toJson()),
      (_) {},
    );
  }

  @override
  Future<NotificationPreferencesModel> getNotificationPreferences() async {
    return handleRequest<NotificationPreferencesModel>(
      () => dio.get(Endpoints.notificationPreferences),
      (data) => NotificationPreferencesModel.fromJson(data),
    );
  }
}