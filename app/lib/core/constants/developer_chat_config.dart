import 'app_config.dart';

/// The reader's chat with the developer.
///
/// The limits must agree with `backend/config/devops.js` (`CHAT_MAX_LENGTH`).
abstract final class DeveloperChatConfig {
  static const int maxChars = 2000;

  /// Messages per page when scrolling back.
  static const int pageSize = 50;

  /// The websocket, opened only while the chat is on screen. Behind the production proxy it is the API host's
  /// `/ws`; locally, point it at the socket container: `--dart-define=WS_URL=ws://10.0.2.2:4001/ws`.
  static const String _wsOverride = String.fromEnvironment('WS_URL');

  static String get wsUrl {
    if (_wsOverride.isNotEmpty) return _wsOverride;
    final uri = Uri.parse(AppConfig.apiBaseUrl);
    return uri.replace(scheme: uri.scheme == 'https' ? 'wss' : 'ws', path: '/ws').toString();
  }

  /// The event the server sends for a message in this conversation (`backend/services/dev-chat.js`).
  static const String messageEvent = 'dev.chat.message';

  /// Reconnect pauses: the first, and the longest it grows to.
  static const Duration reconnectMin = Duration(seconds: 2);
  static const Duration reconnectMax = Duration(seconds: 30);
}
