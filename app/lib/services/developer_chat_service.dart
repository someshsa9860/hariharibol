import 'package:flutter/foundation.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/developer_chat_config.dart';
import '../models/developer_chat.dart';
import '../models/json.dart';
import 'api_client.dart';
import 'response_cache.dart';

/// The reader's chat with the developer: what the API says about the conversation, and writing to it.
class DeveloperChatService {
  DeveloperChatService._() : _api = ApiClient.instance;

  @visibleForTesting
  DeveloperChatService.forTesting(this._api);

  static final DeveloperChatService instance = DeveloperChatService._();

  final ApiClient _api;

  /// The newest page of the conversation. Opening it marks the developer's replies read on the server.
  Future<DeveloperThread> thread({String? before}) async {
    final response = await _api.getOrSaved(ApiPaths.developerChat, query: {
      'limit': DeveloperChatConfig.pageSize,
      'before': ?before,
    });
    return DeveloperThread.fromJson(response.json);
  }

  Future<DeveloperMessage> send(String body) async {
    final response = await _api.post(ApiPaths.developerChatMessages, body: {'body': body});
    return DeveloperMessage.fromJson(response.json);
  }

  /// How many of the developer's replies have not been opened.
  Future<int> unread() async {
    final response = await _api.get(ApiPaths.developerChatUnread);
    return asInt(response.json['count']);
  }

  Future<void> markRead() => _api.post(ApiPaths.developerChatRead);
}
