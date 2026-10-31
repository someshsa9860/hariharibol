import 'dart:io';
import 'dart:typed_data';

import '../core/constants/api_paths.dart';
import '../models/json.dart';
import '../models/paged.dart';
import '../models/support.dart';
import 'api_client.dart';
import 'device_service.dart';
import 'response_cache.dart';

/// Everything the Help and feedback screens ask the API for.
class SupportService {
  SupportService._();

  static final SupportService instance = SupportService._();

  final ApiClient _api = ApiClient.instance;

  /// What the phone says about itself, sent with every ticket so the reader is
  /// not asked for it. Nothing here identifies the person beyond the account.
  Map<String, Object> get deviceInfo {
    final device = DeviceService.instance;
    return {
      'platform': device.platform,
      'appVersion': device.appVersion,
      'osVersion': ?device.osVersion,
      'deviceModel': ?device.deviceModel,
      'locale': Platform.localeName,
      'timezone': device.timezone,
    };
  }

  Future<Paged<SupportTicket>> tickets({int page = 1}) async {
    final response = await _api.getOrSaved(ApiPaths.supportTickets, query: {'page': page});
    return Paged.fromResponse(response.data, response.meta, SupportTicket.fromJson);
  }

  /// The conversation. Opening it marks the staff reply read on the server.
  Future<SupportTicket> ticket(String id) async {
    final response = await _api.getOrSaved(ApiPaths.supportTicket(id));
    return SupportTicket.fromJson(response.json);
  }

  /// How many tickets have a reply the reader has not opened.
  Future<int> unread() async {
    final response = await _api.get(ApiPaths.supportUnread);
    return asInt(response.json['count']);
  }

  /// Sends a screenshot and returns the key to name in [create].
  Future<String> uploadScreenshot(Uint8List bytes, String contentType) async {
    final response = await _api.postBytes(ApiPaths.supportMedia, bytes, contentType: contentType);
    return asString(response.json['key']);
  }

  /// A ticket. A translation request names its book and reading language in [translation]; the server reads the
  /// titles from them.
  Future<SupportTicket> create({
    required String category,
    required String message,
    String? screenshotKey,
    ({String bookSlug, String languageCode})? translation,
  }) async {
    final response = await _api.post(ApiPaths.supportTickets, body: {
      'kind': 'TICKET',
      'category': category,
      'message': message,
      'screenshotKey': ?screenshotKey,
      if (translation != null)
        'details': {'bookSlug': translation.bookSlug, 'languageCode': translation.languageCode},
      'deviceInfo': deviceInfo,
    });
    return SupportTicket.fromJson(response.json);
  }

  /// Quick feedback: stars and an optional note.
  Future<SupportTicket> sendFeedback({required String category, required int rating, String note = ''}) async {
    final response = await _api.post(ApiPaths.supportTickets, body: {
      'kind': 'FEEDBACK',
      'category': category,
      'rating': rating,
      'message': note,
      'deviceInfo': deviceInfo,
    });
    return SupportTicket.fromJson(response.json);
  }

  Future<SupportMessage> reply(String id, String body) async {
    final response = await _api.post(ApiPaths.supportTicketMessages(id), body: {'body': body});
    return SupportMessage.fromJson(response.json);
  }

  // ── The store-rating prompt ────────────────────────────────────────────────

  /// Whether the server thinks this is a good moment to ask.
  Future<bool> shouldAskForReview(String trigger) async {
    final response = await _api.get(ApiPaths.reviewCheck, query: {'trigger': trigger});
    return asBool(response.json['ask']);
  }

  /// `SHOWN`, `LIKED`, `UNHAPPY` or `DISMISSED`.
  Future<void> recordReviewPrompt(String trigger, String outcome) async {
    await _api.post(ApiPaths.reviewPrompts, body: {'trigger': trigger, 'outcome': outcome});
  }
}
