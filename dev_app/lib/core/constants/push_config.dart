/// What the backend puts in a push's `data` (services/dev-push.js).
abstract final class PushConfig {
  static const String deeplinkKey = 'deeplink';
  static const String typeKey = 'type';

  /// `feed` opens the live tab; `chat/<conversationId>` opens that conversation; `ticket/<id>` a ticket.
  static const String feed = 'feed';
  static const String chatPrefix = 'chat/';
  static const String ticketPrefix = 'ticket/';
}
