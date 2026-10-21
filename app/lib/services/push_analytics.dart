import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../core/constants/api_paths.dart';
import '../core/session/app_session.dart';
import 'api_client.dart';
import 'device_service.dart';

/// Tells the backend what happened to a push: it reached this phone, it was
/// tapped, and how long the reader stayed after tapping it. The admin panel's
/// Notifications page turns these into sent / delivered / opened / read.
///
/// Every push the backend sends carries a `pushId` in its data; a message
/// without one (an older push, a test from the Firebase console) is ignored.
///
/// **What can be seen.** A push that arrives while the app is open runs app
/// code, so it is reported as *delivered*. One that Android or iOS draws while
/// the app is closed runs nothing of ours — the first sign of it is the reader
/// tapping it, and a tap counts as delivered too. So *delivered* is a floor, not
/// a census.
///
/// **Reading time** starts at the tap and ends when the screen it opened is
/// left, or the app goes to the background, whichever comes first.
///
/// Nothing here may disturb the reader: a failed report is kept and sent with
/// the next one, and the queue is bounded.
class PushAnalytics with WidgetsBindingObserver {
  PushAnalytics._()
      : _send = _post,
        _live = true,
        _newStopwatch = Stopwatch.new;

  @visibleForTesting
  PushAnalytics.withSender(this._send, {Stopwatch Function()? stopwatch})
      : _live = false,
        _newStopwatch = stopwatch ?? Stopwatch.new;

  static final PushAnalytics instance = PushAnalytics._();

  static const String _pushIdKey = 'pushId';
  static const int _maxQueued = 100;

  /// Shorter than this is not a reading, just a screen passed through.
  static const Duration _shortestStay = Duration(seconds: 1);

  final Future<void> Function(List<Map<String, dynamic>> events) _send;
  final Stopwatch Function() _newStopwatch;

  /// False in tests, which have no session to be signed in to.
  final bool _live;

  final List<Map<String, dynamic>> _queue = [];
  final Set<String> _delivered = {};
  bool _flushing = false;
  bool _watchingLifecycle = false;

  String? _readingPush;
  String? _readingScreen;
  Stopwatch? _readingTime;

  static Future<void> _post(List<Map<String, dynamic>> events) async {
    await ApiClient.instance.post(ApiPaths.notificationEvents, body: {
      'deviceId': DeviceService.instance.deviceId,
      'events': events,
    });
  }

  String? _pushId(Map<String, dynamic> data) {
    final id = data[_pushIdKey]?.toString().trim();
    return id == null || id.isEmpty ? null : id;
  }

  /// A push arrived while the app was open.
  void delivered(Map<String, dynamic> data) {
    final id = _pushId(data);
    if (id == null || !_delivered.add(id)) return;
    _enqueue({'pushId': id, 'event': 'DELIVERED'});
  }

  /// A push was tapped. [screen] is where the tap took the reader, if anywhere.
  void opened(Map<String, dynamic> data, {String? screen}) {
    final id = _pushId(data);
    if (id == null) return;

    // Tapping it proves it arrived, even if the app was closed when it did.
    if (_delivered.add(id)) _enqueue({'pushId': id, 'event': 'DELIVERED'});
    _enqueue({'pushId': id, 'event': 'OPENED'});

    endReading();
    _readingPush = id;
    _readingScreen = screen;
    _readingTime = _newStopwatch()..start();
    if (!_watchingLifecycle) {
      _watchingLifecycle = true;
      WidgetsBinding.instance.addObserver(this);
    }
  }

  /// The reader left what the push opened, or the app went away.
  void endReading() {
    final id = _readingPush;
    final time = _readingTime;
    _readingPush = null;
    _readingTime = null;
    if (id == null || time == null) return;

    time.stop();
    if (time.elapsed < _shortestStay) return;
    _enqueue({
      'pushId': id,
      'event': 'ENGAGED',
      'durationMs': time.elapsedMilliseconds,
      if (_readingScreen != null) 'screen': _readingScreen,
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) endReading();
  }

  void _enqueue(Map<String, dynamic> event) {
    _queue.add({...event, 'at': DateTime.now().toUtc().toIso8601String()});
    if (_queue.length > _maxQueued) _queue.removeAt(0);
    unawaited(flush());
  }

  /// Sends what is waiting. A failure leaves it queued for the next try.
  @visibleForTesting
  Future<void> flush() async {
    if (_flushing || _queue.isEmpty) return;
    if (_live && !AppSession.instance.isSignedIn) return;

    _flushing = true;
    try {
      // Reports added while one batch is in flight are picked up by the loop.
      while (_queue.isNotEmpty) {
        final batch = _queue.take(50).toList();
        await _send(batch);
        _queue.removeRange(0, batch.length);
      }
    } catch (error) {
      debugPrint('Push report not sent, will retry: $error');
    } finally {
      _flushing = false;
    }
  }
}
