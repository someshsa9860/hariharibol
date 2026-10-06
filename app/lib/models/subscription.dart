import 'json.dart';

/// One way of buying a plan: a store product, a price and a billing period.
///
/// The same plan costs a different amount on each store, so a plan carries a
/// list of these rather than one price. [priceMinor] is what the panel set and
/// what the screen falls back on; the amount the store actually charges is the
/// localised price on its own product details, which the purchase service reads
/// when it can.
class PlanPrice {
  const PlanPrice({
    required this.id,
    required this.provider,
    required this.productId,
    required this.priceMinor,
    required this.currency,
    required this.periodDays,
    required this.trialDays,
  });

  final String id;

  /// `GOOGLE_PLAY` or `APPLE_APP_STORE` — the same keys the backend uses.
  final String provider;

  /// What this store knows the product by.
  final String productId;

  /// Paise or cents — never a float.
  final int priceMinor;
  final String currency;
  final int periodDays;
  final int trialDays;

  bool get hasTrial => trialDays > 0;

  factory PlanPrice.fromJson(Json json) => PlanPrice(
        id: asString(json['id']),
        provider: asString(json['provider']),
        productId: asString(json['productId']),
        priceMinor: asInt(json['priceMinor']),
        currency: asString(json['currency'], 'INR'),
        periodDays: asInt(json['periodDays'], 30),
        trialDays: asInt(json['trialDays']),
      );
}

/// What a plan does for one feature. [limit] is null for "unlimited" and is
/// only meaningful when the feature is a limit rather than a flag.
class FeatureValue {
  const FeatureValue({required this.enabled, this.limit});

  final bool enabled;
  final int? limit;

  factory FeatureValue.fromJson(Json json) => FeatureValue(
        enabled: asBool(json['enabled']),
        limit: asIntOrNull(json['limit']),
      );
}

/// A thing a plan can unlock, as the catalogue describes it.
class FeatureDef {
  const FeatureDef({
    required this.key,
    required this.name,
    required this.kind,
    this.description,
    this.unit,
  });

  /// What code asks about — `ads.removed`. Permanent.
  final String key;
  final String name;
  final String? description;

  /// `FLAG` (on or off) or `LIMIT` (a number).
  final String kind;
  final String? unit;

  bool get isLimit => kind == 'LIMIT';

  factory FeatureDef.fromJson(Json json) => FeatureDef(
        key: asString(json['key']),
        name: asString(json['name']),
        description: asStringOrNull(json['description']),
        kind: asString(json['kind'], 'FLAG'),
        unit: asStringOrNull(json['unit']),
      );
}

/// A tier. `free` is the baseline everyone is on; paid plans sit above it.
class SubscriptionPlan {
  const SubscriptionPlan({
    required this.id,
    required this.slug,
    required this.name,
    required this.tier,
    required this.isFree,
    required this.prices,
    required this.features,
    this.description,
  });

  final String id;
  final String slug;
  final String name;
  final String? description;
  final int tier;
  final bool isFree;
  final List<PlanPrice> prices;

  /// By feature key.
  final Map<String, FeatureValue> features;

  factory SubscriptionPlan.fromJson(Json json) {
    final features = json['features'];
    return SubscriptionPlan(
      id: asString(json['id']),
      slug: asString(json['slug']),
      name: asString(json['name']),
      description: asStringOrNull(json['description']),
      tier: asInt(json['tier']),
      isFree: asBool(json['isFree']),
      prices: (json['prices'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => PlanPrice.fromJson(Json.from(item)))
          .toList(),
      features: features is Map
          ? {
              for (final entry in features.entries)
                entry.key.toString(): FeatureValue.fromJson(Json.from(entry.value as Map)),
            }
          : const {},
    );
  }
}

/// Everything the plans screen needs, in one response.
class PlanCatalog {
  const PlanCatalog({required this.plans, required this.features});

  /// Lowest tier first — Free, then upwards.
  final List<SubscriptionPlan> plans;
  final List<FeatureDef> features;

  factory PlanCatalog.fromJson(Json json) => PlanCatalog(
        plans: (json['plans'] as List? ?? const [])
            .whereType<Map>()
            .map((item) => SubscriptionPlan.fromJson(Json.from(item)))
            .toList(),
        features: (json['features'] as List? ?? const [])
            .whereType<Map>()
            .map((item) => FeatureDef.fromJson(Json.from(item)))
            .toList(),
      );
}

/// The plan someone is on, as the entitlement endpoint names it.
class CurrentPlan {
  const CurrentPlan({required this.id, required this.slug, required this.name, required this.tier, required this.isFree});

  final String id;
  final String slug;
  final String name;
  final int tier;
  final bool isFree;

  factory CurrentPlan.fromJson(Json json) => CurrentPlan(
        id: asString(json['id']),
        slug: asString(json['slug']),
        name: asString(json['name']),
        tier: asInt(json['tier']),
        isFree: asBool(json['isFree']),
      );
}

/// The renewing subscription behind a plan, if there is one. A donor is on a
/// paid plan with none of these.
class ActiveSubscription {
  const ActiveSubscription({
    required this.status,
    required this.provider,
    required this.autoRenew,
    this.currentPeriodEnd,
  });

  final String status;
  final String provider;
  final bool autoRenew;
  final DateTime? currentPeriodEnd;

  factory ActiveSubscription.fromJson(Json json) => ActiveSubscription(
        status: asString(json['status']),
        provider: asString(json['provider']),
        autoRenew: asBool(json['autoRenew']),
        currentPeriodEnd: asDate(json['currentPeriodEnd']),
      );
}

/// What this person is entitled to, and why.
class Entitlement {
  const Entitlement({
    required this.isPremium,
    required this.reason,
    required this.features,
    this.plan,
    this.premiumUntil,
    this.subscription,
  });

  final bool isPremium;

  /// `SUBSCRIPTION`, `DONATION` or `NONE`. A donor has a paid plan that never
  /// lapses; a subscriber has one that renews.
  final String reason;
  final CurrentPlan? plan;
  final DateTime? premiumUntil;
  final ActiveSubscription? subscription;

  /// The plan's value for every active feature, by key.
  final Map<String, FeatureValue> features;

  bool get isDonor => reason == 'DONATION';

  /// Whether the plan switches this feature on. A feature the app has not heard
  /// of is off — the safe answer for something that might be a paid benefit.
  bool can(String featureKey) => features[featureKey]?.enabled ?? false;

  /// The numeric limit, or null when it is unlimited (or not a limit at all).
  int? limitOf(String featureKey) => features[featureKey]?.limit;

  static const Entitlement none = Entitlement(isPremium: false, reason: 'NONE', features: {});

  factory Entitlement.fromJson(Json json) {
    final features = json['features'];
    final plan = json['plan'];
    final subscription = json['subscription'];
    return Entitlement(
      isPremium: asBool(json['isPremium']),
      reason: asString(json['reason'], 'NONE'),
      premiumUntil: asDate(json['premiumUntil']),
      plan: plan is Map ? CurrentPlan.fromJson(Json.from(plan)) : null,
      subscription: subscription is Map ? ActiveSubscription.fromJson(Json.from(subscription)) : null,
      features: features is Map
          ? {
              for (final entry in features.entries)
                entry.key.toString(): FeatureValue.fromJson(Json.from(entry.value as Map)),
            }
          : const {},
    );
  }
}
