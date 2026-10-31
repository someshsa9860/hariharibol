import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../core/constants/developer_chat_config.dart';
import '../core/session/app_session.dart';
import '../models/json.dart';

/// One frame from the server's websocket: `{ event, payload }`.
class LiveEvent {
  const LiveEvent(this.event, this.payload);

  final String event;
  final Json payload;
}

typedef LiveConnector = WebSocketChannel Function(Uri uri);

/// The line to the backend's websocket container (`/ws`), for a screen that wants things as they happen — today
/// the chat with the developer. It is opened by the screen and closed with it, reconnects by itself with a
/// growing pause, and only listens: everything the reader does goes through the HTTP API.
class LiveSocket {
  LiveSocket({LiveConnector? connector}) : _connector = connector ?? WebSocketChannel.connect;

  final LiveConnector _connector;
  final StreamController<LiveEvent> _events = StreamController.broadcast();

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _retry;
  int _attempts = 0;
  bool _open = false;

  /// Whether the line is open right now. A screen can show it, or hold back what the socket already brings.
  final ValueNotifier<bool> connected = ValueNotifier(false);

  Stream<LiveEvent> get events => _events.stream;

  void start() {
    _open = true;
    if (_channel == null && _retry == null) unawaited(_connect());
  }

  void stop() {
    _open = false;
    _retry?.cancel();
    _retry = null;
    _close();
  }

  /// The app came back to the front: a socket the system closed meanwhile is reopened at once.
  void resume() {
    if (!_open || _channel != null) return;
    _retry?.cancel();
    _retry = null;
    _attempts = 0;
    unawaited(_connect());
  }

  Future<void> _connect() async {
    final token = AppSession.instance.accessToken;
    if (!_open || token == null) return;
    final base = Uri.parse(DeveloperChatConfig.wsUrl);
    final uri = base.replace(queryParameters: {...base.queryParameters, 'token': token});
    try {
      final channel = _connector(uri);
      _channel = channel;
      await channel.ready;
      if (_channel != channel) return;
      _attempts = 0;
      connected.value = true;
      _subscription = channel.stream.listen(_onFrame, onError: (_) => _onClosed(channel), onDone: () => _onClosed(channel));
    } catch (error) {
      debugPrint('Live socket did not open: $error');
      _onClosed(_channel);
    }
  }

  void _onFrame(dynamic raw) {
    try {
      final json = asJson(jsonDecode(raw as String));
      final event = asString(json?['event']);
      if (event.isEmpty) return;
      _events.add(LiveEvent(event, asJson(json?['payload']) ?? const {}));
    } catch (error) {
      debugPrint('Bad live frame: $error');
    }
  }

  void _onClosed(WebSocketChannel? channel) {
    if (channel != null && channel != _channel) return;
    _close();
    if (!_open) return;
    _attempts += 1;
    final seconds = DeveloperChatConfig.reconnectMin.inSeconds * (1 << (_attempts - 1).clamp(0, 5));
    final pause = Duration(seconds: seconds.clamp(0, DeveloperChatConfig.reconnectMax.inSeconds));
    _retry?.cancel();
    _retry = Timer(pause, () {
      _retry = null;
      unawaited(_connect());
    });
  }

  void _close() {
    connected.value = false;
    _subscription?.cancel();
    _subscription = null;
    final channel = _channel;
    _channel = null;
    try {
      channel?.sink.close();
    } catch (_) {}
  }

  void dispose() {
    stop();
    _events.close();
    connected.dispose();
  }
}
