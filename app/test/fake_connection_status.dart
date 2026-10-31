// A stand-in for the phone's connection that a test turns on and off.

import 'dart:async';

import 'package:hariharibol/services/connection_status.dart';

class FakeConnectionStatus implements ConnectionStatus {
  FakeConnectionStatus({this.isOnline = true});

  bool isOnline;

  /// Handed out first, one to each question, for a connection that goes between
  /// two of them.
  final List<bool> answers = [];

  final StreamController<bool> _changes = StreamController<bool>.broadcast();

  @override
  Future<bool> online() async => answers.isNotEmpty ? answers.removeAt(0) : isOnline;

  @override
  Stream<bool> get changes => _changes.stream;

  /// The connection comes ([on]) or goes, and the listeners are told.
  void turn({required bool on}) {
    isOnline = on;
    _changes.add(on);
  }
}
