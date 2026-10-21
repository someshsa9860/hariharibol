import '../core/constants/api_paths.dart';
import '../models/json.dart';
import '../models/share.dart';
import 'api_client.dart';

/// Share links and AI backgrounds. Rules live on the server (`services/share.js`): a link's code is random, one per
/// target, and refused for anything not public.
class ShareService {
  ShareService._();

  static final ShareService instance = ShareService._();

  final ApiClient _api = ApiClient.instance;

  Future<ShareLink> linkFor(String kind, String targetId) async {
    final response = await _api.post(ApiPaths.shareLinks, body: {'kind': kind, 'targetId': targetId});
    return ShareLink.fromJson(response.json);
  }

  /// Public: what a link's code opens. Throws `ApiFailure` (404 unknown, 410 taken down).
  Future<ResolvedShare> resolve(String code, {String? kind}) async {
    final response = await _api.get(ApiPaths.shareLink(code), query: {'kind': ?kind});
    return ResolvedShare.fromJson(response.json);
  }

  Future<BackgroundQuote> backgroundQuote() async {
    final response = await _api.get(ApiPaths.shareBackgroundQuote);
    return BackgroundQuote.fromJson(response.json);
  }

  /// Makes a background, charged once per [requestId] — send the same id when retrying a failure so it is never
  /// charged twice. Returns a temporary link to the picture. Throws `ApiFailure`: 402 when the wallet cannot pay.
  Future<String> makeBackground({required String requestId, required String prompt}) async {
    final response = await _api.post(
      ApiPaths.shareBackground,
      body: {'requestId': requestId, 'prompt': prompt},
    );
    final Json json = response.json;
    final url = json['imageUrl'] as String?;
    if (url == null) throw StateError('the background has no picture');
    return url;
  }
}
