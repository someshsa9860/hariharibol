class Endpoints {
  // Base URL
  static const String baseUrl = 'https://api.hariharibol.com';

  // Auth
  static const String login = '/auth/login';
  static const String refreshToken = '/auth/refresh';
  static const String googleAuth = '/auth/google';
  static const String appleAuth = '/auth/apple';

  // User
  static const String userProfile = '/users/profile';
  static const String updateProfile = '/users/profile';
  static const String deviceRegister = '/users/devices';

  // Content
  static const String sampradayas = '/sampradayas';
  static String sampradayaDetail(String slug) => '/sampradayas/$slug';
  static String sampradayaMantras(String id) => '/sampradayas/$id/mantras';
  static String followSampradaya(String id) => '/sampradayas/$id/follow';
  static String unfollowSampradaya(String id) => '/sampradayas/$id/follow';
  static const String followedSampradayas = '/sampradayas/me/followed';

  static const String books = '/books';
  static const String bookDetail = '/books/{id}';
  static const String chapters = '/books/{id}/chapters';
  static const String verses = '/chapters/{id}/verses';
  static const String verseDetail = '/verses/{id}';
  static const String randomVerse = '/verses/random';
  static const String verseOfDay = '/verses/day';

  static const String narrations = '/narrations';
  static const String narrationDetail = '/narrations/{id}';

  static const String mantras = '/mantras';
  static String mantraDetail(String id) => '/mantras/$id';

  // Chanting
  static const String chantingLog = '/chanting/log';
  static const String chantingHistory = '/chanting/history';
  static const String chantingStats = '/chanting/stats';
  static const String chantingStreaks = '/chanting/streaks';

  // Favorites
  static const String favorites = '/favorites';
  static const String addFavorite = '/favorites';
  static const String removeFavorite = '/favorites/{id}';

  // Recommendations
  static const String recommendations = '/recommendations';

  // Translations
  static const String translations = '/translations';
  static const String localeStrings = '/translations/locale/{locale}';

  // Languages
  static const String languages = '/languages';

  // Chatbot
  static const String chatbotSessions = '/chatbot/sessions';
  static String chatbotSession(String id) => '/chatbot/sessions/$id';
  static String sendChatbotMessage(String id) => '/chatbot/sessions/$id/messages';
  static const String suggestedPrompts = '/chatbot/suggested-prompts';

  // Notifications
  static const String registerDeviceToken = '/notifications/register';
  static const String notificationPreferences = '/notifications/preferences';

  // Groups
  static const String groups = '/groups';
  static const String myGroups = '/groups/me';
  static String groupDetail(String id) => '/groups/$id';
  static String groupMessages(String id) => '/groups/$id/messages';
  static String sendMessage(String id) => '/groups/$id/messages';
  static String joinGroup(String id) => '/groups/$id/join';
  static String leaveGroup(String id) => '/groups/$id/leave';
  static String reportMessage(String groupId, String messageId) => '/groups/$groupId/messages/$messageId/report';

  // Moderation (admin)
  static const String reportContent = '/moderation/report';

  // Helper method to build URL with params
  static String buildUrl(String endpoint, [Map<String, String>? params]) {
    String url = '$baseUrl$endpoint';
    if (params != null) {
      params.forEach((key, value) {
        url = url.replaceAll('{$key}', value);
      });
    }
    return url;
  }
}