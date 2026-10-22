import '../core/constants/api_paths.dart';
import '../core/constants/app_config.dart';
import '../models/dev_event.dart';
import '../models/dev_message.dart';
import '../models/dev_summary.dart';
import '../models/json.dart';
import '../models/ticket.dart';
import 'api_client.dart';

/// A page of something, and whether there is more after it.
class Paged<T> {
  const Paged(this.items, this.hasMore);

  final List<T> items;
  final bool hasMore;
}

/// The conversation's messages (oldest first) with the conversation they belong to.
class ThreadPage {
  const ThreadPage(this.conversation, this.messages, this.hasMore);

  final DevConversation conversation;
  final List<DevMessage> messages;
  final bool hasMore;
}

/// Every call the developer companion makes to the backend (`/api/admin/dev/*`, plus the support desk).
/// Failures are [ApiFailure]s; screens word them through `describe`.
class DevService {
  DevService._() : _api = ApiClient.instance;

  DevService.forTesting(this._api);

  static final DevService instance = DevService._();

  final ApiClient _api;

  Future<DevSummary> summary() async => DevSummary.fromJson((await _api.get(ApiPaths.devSummary)).json);

  Future<Paged<DevEvent>> feed({String? before, String? typePrefix}) async {
    final response = await _api.get(ApiPaths.devFeed, query: {
      'limit': AppConfig.pageSize,
      'before': ?before,
      'type': ?typePrefix,
    });
    final json = response.json;
    return Paged(asList(json['items'], DevEvent.fromJson), asBool(json['hasMore']));
  }

  Future<Paged<DevConversation>> conversations({String? before}) async {
    final response = await _api.get(ApiPaths.devConversations, query: {
      'limit': AppConfig.pageSize,
      'before': ?before,
    });
    final json = response.json;
    return Paged(asList(json['items'], DevConversation.fromJson), asBool(json['hasMore']));
  }

  Future<ThreadPage> thread(String conversationId, {String? before}) async {
    final response = await _api.get(ApiPaths.devMessages(conversationId), query: {'limit': 50, 'before': ?before});
    final json = response.json;
    return ThreadPage(
      DevConversation.fromJson(asJson(json['conversation']) ?? const {}),
      asList(json['messages'], DevMessage.fromJson),
      asBool(json['hasMore']),
    );
  }

  Future<DevMessage> reply(String conversationId, String body) async {
    final response = await _api.post(ApiPaths.devMessages(conversationId), body: {'body': body});
    return DevMessage.fromJson(response.json);
  }

  Future<void> markRead(String conversationId) => _api.post(ApiPaths.devRead(conversationId));

  /// Starts (or continues) a conversation with a reader; answers the conversation id.
  Future<String> startConversation(String userId, String body) async {
    final response = await _api.post(ApiPaths.devConversations, body: {'userId': userId, 'body': body});
    return asString(response.json['conversationId']);
  }

  Future<List<ChatPerson>> findReaders(String query) async {
    final response = await _api.get(ApiPaths.devUsers, query: {'q': query, 'limit': 20});
    return asList(response.json['items'], ChatPerson.fromJson);
  }

  Future<DevPrefs> prefs() async => DevPrefs.fromJson((await _api.get(ApiPaths.devPrefs)).json);

  Future<DevPrefs> savePrefs(DevPrefs prefs) async =>
      DevPrefs.fromJson((await _api.put(ApiPaths.devPrefs, body: prefs.toJson())).json);

  // ── Support desk (needs `support.manage`) ──

  Future<Paged<Ticket>> tickets({int page = 1, String? status, String? kind}) async {
    final response = await _api.get(ApiPaths.supportTickets, query: {
      'page': page,
      'pageSize': AppConfig.pageSize,
      'status': ?status,
      'kind': ?kind,
    });
    return Paged(asList(response.data, Ticket.fromJson), asBool(response.meta?['hasMore']));
  }

  Future<TicketDetail> ticket(String id) async => TicketDetail.fromJson((await _api.get(ApiPaths.supportTicket(id))).json);

  Future<TicketMessage> replyToTicket(String id, String body) async =>
      TicketMessage.fromJson((await _api.post(ApiPaths.supportReply(id), body: {'body': body})).json);

  Future<void> setTicketStatus(String id, String status) => _api.patch(ApiPaths.supportTicket(id), body: {'status': status});
}
