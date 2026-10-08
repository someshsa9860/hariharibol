import 'package:flutter/foundation.dart';

/// Whether the launch animation has finished.
///
/// The session is restored before `runApp`, so by the time the router first
/// runs it already knows where to send the person — and without something
/// holding it, the splash would be on screen for a single frame. This is that
/// something: the router leaves the splash alone until the splash says it is
/// done, and then its ordinary redirect carries on as if nothing had happened.
///
/// It only ever holds the splash itself. A cold start that arrives with a
/// deep link goes straight there, because the animation is not worth losing
/// somebody's destination for.
class SplashGate extends ChangeNotifier {
  SplashGate._();

  static final SplashGate instance = SplashGate._();

  bool _isOpen = false;

  /// True once the router may move off the splash.
  bool get isOpen => _isOpen;

  void open() {
    if (_isOpen) return;
    _isOpen = true;
    notifyListeners();
  }

  /// Back to holding. Only a test has a reason to — in the app the splash runs
  /// once per process.
  @visibleForTesting
  void close() => _isOpen = false;
}
