import 'json.dart';

class ReferralReward {
  const ReferralReward({required this.startsAt, required this.endsAt});

  factory ReferralReward.fromJson(Json json) => ReferralReward(
        startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
        endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
      );

  final DateTime startsAt;
  final DateTime endsAt;
}

class ReferralEntry {
  const ReferralEntry({required this.name, required this.status, required this.claimedAt});

  factory ReferralEntry.fromJson(Json json) => ReferralEntry(
        name: json['name'] as String?,
        status: json['status'] as String? ?? 'PENDING',
        claimedAt: DateTime.parse(json['claimedAt'] as String).toLocal(),
      );

  final String? name;

  /// `PENDING`, `REWARDED` or `REJECTED`.
  final String status;
  final DateTime claimedAt;
}

/// Everything Refer & Earn shows: the reader's own code and link, the counts, the granted months and the history.
class ReferralSummary {
  const ReferralSummary({
    required this.code,
    required this.url,
    required this.rewardDays,
    required this.pending,
    required this.rewarded,
    required this.rewards,
    required this.history,
    required this.referredBy,
  });

  factory ReferralSummary.fromJson(Json json) {
    final rules = asJson(json['rules']) ?? const {};
    final totals = asJson(json['totals']) ?? const {};
    return ReferralSummary(
      code: json['code'] as String,
      url: json['url'] as String,
      rewardDays: (rules['rewardDays'] as num?)?.toInt() ?? 30,
      pending: (totals['pending'] as num?)?.toInt() ?? 0,
      rewarded: (totals['rewarded'] as num?)?.toInt() ?? 0,
      rewards: [
        for (final r in (json['rewards'] as List<dynamic>? ?? const []))
          if (asJson(r) case final item?) ReferralReward.fromJson(item),
      ],
      history: [
        for (final h in (json['history'] as List<dynamic>? ?? const []))
          if (asJson(h) case final item?) ReferralEntry.fromJson(item),
      ],
      referredBy: json['referredBy'] != null,
    );
  }

  final String code;
  final String url;
  final int rewardDays;
  final int pending;
  final int rewarded;
  final List<ReferralReward> rewards;
  final List<ReferralEntry> history;

  /// This reader was themselves invited, so the "enter a code" box has nothing left to do.
  final bool referredBy;
}
