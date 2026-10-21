import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/app_config.dart';
import '../core/constants/group_config.dart';
import '../core/session/app_session.dart';
import '../models/json.dart';
import 'api_client.dart';

/// One server-sent event: `{event, payload}`.
class RealtimeEvent {
  const RealtimeEvent(this.name, this.payload);

  final String name;
  final Json payload;
}

/// The live channel from the API's websocket container (`backend/websocket/`).
///
/// One socket for the whole app, opened when the first screen starts listening
/// and closed a moment after the last one stops. It is one-way: the server
/// sends events and everything the app *does* is an ordinary API call. A dropped
/// connection is reopened with a growing wait; a token the server refuses (close
/// code 4001) is renewed through the API's normal refresh first.
class RealtimeService {
  RealtimeService._();

  static final RealtimeService instance = RealtimeService._();

  final StreamController<RealtimeEvent> _events = StreamController<RealtimeEvent>.broadcast();

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _ping;
  Timer? _retry;
  Timer? _linger;
  int _listeners = 0;
  int _attempts = 0;

  /// Every event, for whoever is [retain]ing the socket. Filter by name.
  Stream<RealtimeEvent> get events => _events.stream;

  /// Starts the socket if it is not running. Pair every call with [release].
  void retain() {
    _linger?.cancel();
    _linger = null;
    _listeners += 1;
    _open();
  }

  void release() {
    _listeners = (_listeners - 1).clamp(0, 1 << 30);
    if (_listeners > 0) return;
    _linger = Timer(GroupConfig.socketLinger, _close);
  }

  void _open() {
    final token = AppSession.instance.accessToken;
    if (token == null || _channel != null || _listeners == 0) return;

    final channel = WebSocketChannel.connect(Uri.parse('${AppConfig.wsUrl}?token=${Uri.encodeQueryComponent(token)}'));
    _channel = channel;

    _subscription = channel.stream.listen(
      _onFrame,
      onError: (_) {},
      onDone: () => _onClosed(channel),
      cancelOnError: true,
    );
    channel.ready.then((_) {
      if (_channel != channel) return;
      _attempts = 0;
      _ping?.cancel();
      _ping = Timer.periodic(GroupConfig.socketPing, (_) => channel.sink.add(jsonEncode({'type': 'ping'})));
    }).catchError((Object _) {
      // The connection never opened; onDone follows and schedules the retry.
    });
  }

  void _onFrame(dynamic frame) {
    try {
      final message = asJson(jsonDecode(frame as String));
      if (message == null) return;
      _events.add(RealtimeEvent(asString(message['event']), asJson(message['payload']) ?? const {}));
    } on FormatException {
      // A frame that is not ours.
    }
  }

  Future<void> _onClosed(WebSocketChannel channel) async {
    if (_channel != channel) return;
    final code = channel.closeCode;
    _teardown();
    if (_listeners == 0) return;

    // An expired token: any authenticated call renews it, then the next try carries the new one.
    if (code == GroupConfig.closeBadToken) {
      try {
        await ApiClient.instance.get(ApiPaths.groups);
      } on Object {
        // Offline, or signed out: the retry below finds out.
      }
    }

    _attempts += 1;
    final wait = GroupConfig.reconnectFirst * (1 << (_attempts - 1).clamp(0, 5));
    _retry = Timer(wait > GroupConfig.reconnectMax ? GroupConfig.reconnectMax : wait, _open);
  }

  void _teardown() {
    _ping?.cancel();
    _ping = null;
    _retry?.cancel();
    _retry = null;
    _subscription?.cancel();
    _subscription = null;
    _channel = null;
  }

  void _close() {
    final channel = _channel;
    _teardown();
    channel?.sink.close();
  }
}
