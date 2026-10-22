import 'dart:async';
import 'dart:convert';

import 'package:stream_channel/stream_channel.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

/// A websocket the test drives by hand: [push] sends a frame down, [serverClose] closes it with a code,
/// and [sent] is everything the app wrote.
class FakeChannel with StreamChannelMixin<dynamic> implements WebSocketChannel {
  FakeChannel(this.uri);

  final Uri uri;
  final StreamController<dynamic> _incoming = StreamController<dynamic>();
  final List<dynamic> sent = [];
  int? _closeCode;
  bool closedByApp = false;

  late final WebSocketSink _sink = _FakeSink(this);

  void push(String event, [Map<String, dynamic> payload = const {}]) {
    _incoming.add(jsonEncode({'event': event, 'payload': payload, 'at': 0}));
  }

  Future<void> serverClose(int code) async {
    _closeCode = code;
    await _incoming.close();
  }

  @override
  Future<void> get ready async {}

  @override
  Stream<dynamic> get stream => _incoming.stream;

  @override
  WebSocketSink get sink => _sink;

  @override
  int? get closeCode => _closeCode;

  @override
  String? get closeReason => null;

  @override
  String? get protocol => null;
}

class _FakeSink implements WebSocketSink {
  _FakeSink(this.channel);

  final FakeChannel channel;

  @override
  void add(dynamic data) => channel.sent.add(data);

  @override
  void addError(Object error, [StackTrace? stackTrace]) {}

  @override
  Future<void> addStream(Stream<dynamic> stream) async {}

  @override
  Future<void> close([int? closeCode, String? closeReason]) async {
    channel.closedByApp = true;
  }

  @override
  Future<void> get done async {}
}
