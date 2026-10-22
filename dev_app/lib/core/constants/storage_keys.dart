/// Keys in secure storage. Nothing else is stored on the phone: the feed and the chats live on the server.
abstract final class SecureKeys {
  static const String accessToken = 'dev.access_token';
  static const String refreshToken = 'dev.refresh_token';
  static const String refreshExpiresAt = 'dev.refresh_expires_at';
  static const String user = 'dev.user';
  static const String deviceId = 'dev.device_id';
}
