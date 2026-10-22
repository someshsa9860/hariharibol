/// Every route in one place, so a path is never typed twice.
abstract final class AppRoutes {
  static const String splash = '/splash';
  static const String signIn = '/sign-in';

  static const String live = '/live';
  static const String chats = '/chats';
  static const String newChat = '/chats/new';
  static const String tickets = '/tickets';
  static const String settings = '/settings';

  static String chat(String conversationId) => '/chats/$conversationId';
  static String ticket(String id) => '/tickets/$id';
}
