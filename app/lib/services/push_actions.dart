import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'push_link.dart';

/// A button pressed under a push on iOS. The system hands the press to
/// `AppDelegate`, which passes it here on a method channel; one pressed while the
/// app was closed waits in the delegate until [start] asks for it. Android's
/// buttons come through `LocalPushService` instead.
class PushActionChannel {
  PushActionChannel._();

  static final PushActionChannel instance = PushActionChannel._();

  static const MethodChannel _channel = MethodChannel('hariharibol/push_actions');

  bool get isSupported => !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

  Future<void> start() async {
    if (!isSupported) return;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'action') _open(call.arguments);
    });
    try {
      _open(await _channel.invokeMethod<Object?>('takePending'));
    } catch (error) {
      debugPrint('Pending push button unreadable: $error');
    }
  }

  void _open(Object? arguments) {
    if (arguments is! Map) return;
    final id = arguments['actionId']?.toString();
    final data = arguments['data'];
    if (id == null || data is! Map) return;
    PushLinks.instance.tapped(Map<String, dynamic>.from(data), actionId: id);
  }
}
