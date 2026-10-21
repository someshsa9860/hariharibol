import 'json.dart';

/// What the public resolver says a shared verse, mantra or reel is.
class SharedContent {
  const SharedContent({
    required this.type,
    required this.title,
    this.verseId,
    this.bookSlug,
    this.cantoNumber,
    this.chapterNumber,
    this.verseNumber,
    this.mantraSlug,
    this.reelId,
  });

  final String type;
  final String title;
  final String? verseId;
  final String? bookSlug;
  final int? cantoNumber;
  final int? chapterNumber;
  final int? verseNumber;
  final String? mantraSlug;
  final String? reelId;

  factory SharedContent.fromJson(Json json) {
    final place = asJson(json['place']);
    return SharedContent(
      type: asString(json['type']),
      title: asString(json['title']),
      verseId: asStringOrNull(json['verseId']),
      bookSlug: asStringOrNull(place?['bookSlug']),
      cantoNumber: asIntOrNull(place?['cantoNumber']),
      chapterNumber: asIntOrNull(place?['chapterNumber']),
      verseNumber: asIntOrNull(place?['verseNumber']),
      mantraSlug: asStringOrNull(json['mantraSlug']),
      reelId: asStringOrNull(json['reelId']),
    );
  }
}

/// Can this person make a background, and what would it cost them.
class BackgroundQuote {
  const BackgroundQuote({
    required this.enabled,
    required this.affordable,
    required this.costPercent,
    required this.canUpgrade,
    required this.suggestions,
  });

  final bool enabled;
  final bool affordable;

  /// Share of the credit meter one picture takes. Never tokens.
  final int? costPercent;
  final bool canUpgrade;
  final List<String> suggestions;

  factory BackgroundQuote.fromJson(Json json) => BackgroundQuote(
        enabled: asBool(json['enabled']),
        affordable: asBool(json['affordable']),
        costPercent: asIntOrNull(json['costPercent']),
        canUpgrade: asBool(json['canUpgrade']),
        suggestions: [for (final s in (json['suggestions'] as List<dynamic>? ?? const [])) asString(s)],
      );
}

class BackgroundJob {
  const BackgroundJob({required this.id, required this.status});

  final String id;

  /// `PENDING`, `DONE` or `FAILED`.
  final String status;

  bool get isDone => status == 'DONE';
  bool get isFailed => status == 'FAILED';

  factory BackgroundJob.fromJson(Json json) =>
      BackgroundJob(id: asString(json['id']), status: asString(json['status']));
}

class ReferralHistoryItem {
  const ReferralHistoryItem({required this.name, required this.status, required this.invitedAt, this.rewardEndsAt});

  final String name;

  /// `PENDING`, `QUALIFIED`, `REJECTED` or `REVERSED`.
  final String status;
  final DateTime? invitedAt;
  final DateTime? rewardEndsAt;

  factory ReferralHistoryItem.fromJson(Json json) => ReferralHistoryItem(
        name: asString(json['name']),
        status: asString(json['status']),
        invitedAt: DateTime.tryParse(asString(json['invitedAt'])),
        rewardEndsAt: DateTime.tryParse(asString(asJson(json['reward'])?['endsAt'])),
      );
}

class ReferralSummary {
  const ReferralSummary({
    required this.code,
    required this.url,
    required this.invited,
    required this.pending,
    required this.successful,
    required this.rewardDays,
    required this.rewardActiveUntil,
    required this.history,
  });

  final String code;
  final String url;
  final int invited;
  final int pending;
  final int successful;
  final int rewardDays;
  final DateTime? rewardActiveUntil;
  final List<ReferralHistoryItem> history;

  factory ReferralSummary.fromJson(Json json) {
    final totals = asJson(json['totals']);
    final rules = asJson(json['rules']);
    return ReferralSummary(
      code: asString(json['code']),
      url: asString(json['url']),
      invited: asInt(totals?['invited']),
      pending: asInt(totals?['pending']),
      successful: asInt(totals?['successful']),
      rewardDays: asInt(rules?['rewardDays'], 30),
      rewardActiveUntil: DateTime.tryParse(asString(json['rewardActiveUntil'])),
      history: [
        for (final item in (json['history'] as List<dynamic>? ?? const []))
          if (asJson(item) != null) ReferralHistoryItem.fromJson(asJson(item)!),
      ],
    );
  }
}

/// The answer to presenting an invitation code. `reason` is one of the server's
/// short codes (`invalid_code`, `own_code`, `already_referred`, …) when refused.
class AttributionResult {
  const AttributionResult({required this.attributed, this.reason});

  final bool attributed;
  final String? reason;

  factory AttributionResult.fromJson(Json json) =>
      AttributionResult(attributed: asBool(json['attributed']), reason: asStringOrNull(json['reason']));
}
