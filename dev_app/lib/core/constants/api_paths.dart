/// Every endpoint the app calls, in one place.
abstract final class ApiPaths {
  static const String signInSocial = '/api/app/auth/social';
  static const String refresh = '/api/app/auth/refresh';
  static const String logout = '/api/app/auth/logout';
  static const String devices = '/api/app/devices';

  static const String devSummary = '/api/admin/dev/summary';
  static const String devFeed = '/api/admin/dev/feed';
  static const String devConversations = '/api/admin/dev/conversations';
  static const String devUsers = '/api/admin/dev/users';
  static const String devPrefs = '/api/admin/dev/prefs';
  static String devMessages(String conversationId) => '$devConversations/$conversationId/messages';
  static String devRead(String conversationId) => '$devConversations/$conversationId/read';

  static const String me = '/api/admin/me';

  static const String supportSummary = '/api/admin/support/summary';
  static const String supportTickets = '/api/admin/support/tickets';
  static String supportTicket(String id) => '$supportTickets/$id';
  static String supportReply(String id) => '$supportTickets/$id/messages';
}

abstract final class ApiHeaders {
  static const String authorization = 'Authorization';
  static const String deviceId = 'X-Device-Id';
  static const String platform = 'X-Platform';
  static const String appVersion = 'X-App-Version';
  static const String appCheck = 'X-Firebase-AppCheck';
  static const String acceptLanguage = 'Accept-Language';
}

abstract final class ApiCodes {
  static const String unauthenticated = 'UNAUTHENTICATED';
}
