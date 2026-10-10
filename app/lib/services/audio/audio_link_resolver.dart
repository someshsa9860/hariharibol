import '../../core/constants/tts_config.dart';
import '../../models/verse.dart';
import '../book_cache_api.dart';

/// A playable link for a verse's recitation.
///
/// Verses from the API arrive with one. Verses from the offline files carry only
/// a storage key, so links are asked for — for the verse about to play and the
/// few after it in one request — and remembered until they near expiry.
class AudioLinkResolver {
  AudioLinkResolver({BookCacheApi? api, DateTime Function()? clock, this.ttl = TtsConfig.audioLinkTtl})
      : _api = api ?? BookCacheApi(),
        _now = clock ?? DateTime.now;

  final BookCacheApi _api;
  final DateTime Function() _now;
  final Duration ttl;
  final Map<String, _Link> _links = {};

  Future<String?> linkFor(Verse verse, {List<Verse> following = const []}) async {
    final direct = verse.audioUrl;
    if (direct != null && direct.isNotEmpty) return direct;
    if ((verse.audioPath ?? '').isEmpty) return null;

    final cached = _links[verse.id];
    if (cached != null && cached.expires.isAfter(_now())) return cached.url;

    final slug = verse.book?.slug;
    if (slug == null) return null;

    final wanted = <Verse>[
      verse,
      ...following.where((v) => (v.audioPath ?? '').isNotEmpty && (v.audioUrl ?? '').isEmpty && !_fresh(v)),
    ].take(TtsConfig.audioLinkBatch).toList();

    final urls = await _api.audioUrls(slug, [for (final v in wanted) v.id]);
    final expires = _now().add(ttl);
    urls.forEach((id, url) => _links[id] = _Link(url, expires));
    return urls[verse.id];
  }

  bool _fresh(Verse v) => _links[v.id]?.expires.isAfter(_now()) ?? false;

  /// Forgets a link that did not open, so the next ask fetches a new one.
  void forget(Verse verse) => _links.remove(verse.id);
}

class _Link {
  const _Link(this.url, this.expires);

  final String url;
  final DateTime expires;
}
