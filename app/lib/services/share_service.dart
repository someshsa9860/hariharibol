import 'dart:typed_data';

import '../core/constants/api_paths.dart';
import '../core/share_links.dart';
import '../models/api_failure.dart';
import '../models/share.dart';
import 'api_client.dart';

/// Share links, AI backgrounds for share cards, and referrals. Every rule
/// (credit, refunds, who qualifies) lives on the server; this only asks.
class ShareService {
  ShareService._();

  static final ShareService instance = ShareService._();

  final ApiClient _api = ApiClient.instance;

  /// The public link for this content — the same one each time this person
  /// shares the same thing. [targetId] is the verse id, the mantra slug or the
  /// reel id.
  Future<String> link(ShareType type, String targetId) async {
    final response = await _api.post(
      ApiPaths.shareLink,
      body: {'type': type.apiName, 'targetId': targetId},
    );
    return response.json['url'] as String;
  }

  /// [link], or [fallback] when the server cannot make one (offline, signed out).
  Future<String> linkOrFallback(ShareType type, String targetId, String fallback) async {
    try {
      return await link(type, targetId);
    } on ApiFailure {
      return fallback;
    }
  }

  /// What a shared link points at. Public: works before sign-in.
  Future<SharedContent> resolve(ContentLink link) async {
    final response = await _api.get(ApiPaths.sharedContent(link.type.route, link.code));
    return SharedContent.fromJson(response.json);
  }

  Future<BackgroundQuote> backgroundQuote() async {
    final response = await _api.get(ApiPaths.shareBackgroundQuote);
    return BackgroundQuote.fromJson(response.json);
  }

  /// Makes a background. [requestKey] names one attempt: sending the same key
  /// again returns the same picture and is never charged twice. A 402
  /// (`CREDIT_REQUIRED`) is thrown as an ApiFailure before anything is charged.
  Future<BackgroundJob> makeBackground({required String requestKey, required String prompt}) async {
    final response = await _api.post(
      ApiPaths.shareBackground,
      body: {'requestKey': requestKey, 'prompt': prompt},
    );
    return BackgroundJob.fromJson(response.json);
  }

  Future<Uint8List> backgroundImage(String jobId) => _api.getBytes(ApiPaths.shareBackgroundImage(jobId));

  Future<ReferralSummary> referral() async {
    final response = await _api.get(ApiPaths.referralMe);
    return ReferralSummary.fromJson(response.json);
  }

  /// Presents an invitation code. Always answers; `attributed` says whether it counted.
  Future<AttributionResult> attribute(String code, {required bool typed}) async {
    final response = await _api.post(
      ApiPaths.referralAttribute,
      body: {'code': code, 'source': typed ? 'CODE' : 'LINK'},
    );
    return AttributionResult.fromJson(response.json);
  }
}
