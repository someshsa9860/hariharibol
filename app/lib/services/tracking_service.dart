import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

import 'firebase_service.dart';

/// Analytics.
///
/// Every call is a no-op when Firebase is not configured, so screens can log
/// freely without guarding each call — and a developer without the config files
/// is not blocked by it.
class TrackingService {
  TrackingService._();

  static final TrackingService instance = TrackingService._();

  FirebaseAnalytics? _analytics;

  /// The observer the router uses to log screen views.
  FirebaseAnalyticsObserver? get observer =>
      _analytics == null ? null : FirebaseAnalyticsObserver(analytics: _analytics!);

  Future<void> init() async {
    if (!FirebaseService.instance.isAvailable) return;
    _analytics = FirebaseAnalytics.instance;
  }

  Future<void> setUser(String? userId) async {
    try {
      await _analytics?.setUserId(id: userId);
    } catch (error) {
      debugPrint('Analytics setUserId failed: $error');
    }
  }

  Future<void> log(String name, {Map<String, Object>? parameters}) async {
    try {
      await _analytics?.logEvent(name: name, parameters: parameters);
    } catch (error) {
      debugPrint('Analytics event failed: $error');
    }
  }
}
