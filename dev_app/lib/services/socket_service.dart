import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../core/constants/app_config.dart';
import '../core/session/app_session.dart';
import '../models/json.dart';
import 'api_client.dart';

enum SocketStatus {
  /// Not trying: signed out, or the server refused this account.
  idle,
  connecting,
  connected,

  /// The line dropped; a retry is scheduled.
  offline,

  /// The server closed it because this account may not use the app.
  forbidden,
}

/// One frame from the server: `{ event, payload, at }`.
class SocketMessage {
  const SocketMessage(this.event, this.payload);

  final String event;
  final Json payload;
}

/// Opens a channel to a URL. A test passes a fake one.
typedef SocketConnector = WebSocketChannel Function(Uri uri);

/// The live line to the backend's websocket container (`/ws?app=dev`). It reconnects by itself with a growing
/// pause, tells the server every 30 seconds whether the app is on screen (the server holds pushes back while it
/// is), and hands every event to whoever listens on [messages].
///
/// The socket is one-way for data — everything the developer does goes through the HTTP API — so the only thing
/// ever sent is the heartbeat.
class SocketService {
  SocketService({SocketConnector? connector, Random? random})
      : _connector = connector ?? WebSocketChannel.connect,
        _random = random ?? Random();

  static final SocketService instance = SocketService();

  final SocketConnector _connector;
  final Random _random;

  final StreamController<SocketMessage> _messages = StreamController.broadcast();
  final StreamController<SocketStatus> _statuses = StreamController.broadcast();

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _heartbeat;
  Timer? _retry;
  int _attempts = 0;
  bool _wanted = false;
  bool _foreground = true;
  SocketStatus _status = SocketStatus.idle;

  Stream<SocketMessage> get messages => _messages.stream;
  Stream<SocketStatus> get statuses => _statuses.stream;
  SocketStatus get status => _status;

  /// Start (or keep) the connection. Safe to call again.
  void start() {
    _wanted = true;
    if (_channel != null || _retry != null) return;
    unawaited(_connect());
  }

  /// Close it and stay closed (sign-out).
  void stop() {
    _wanted = false;
    _retry?.cancel();
    _retry = null;
    _close();
    _set(SocketStatus.idle);
  }

  /// The app went to the background or came back. Backgrounded, the heartbeat says so at once and the server
  /// starts pushing; foregrounded, the socket is reopened if the OS closed it meanwhile.
  void setForeground(bool value) {
    _foreground = value;
    _sendHeartbeat();
    if (value && _wanted && _channel == null && _status != SocketStatus.forbidden) {
      _retry?.cancel();
      _retry = null;
      _attempts = 0;
      unawaited(_connect());
    }
  }

  Future<void> _connect() async {
    final token = AppSession.instance.accessToken;
    if (!_wanted || token == null) return;
    _set(SocketStatus.connecting);

    final base = Uri.parse(AppConfig.wsUrl);
    final uri = base.replace(queryParameters: {...base.queryParameters, 'token': token, 'app': 'dev'});
    try {
      final channel = _connector(uri);
      _channel = channel;
      await channel.ready;
      if (_channel != channel) return;
      _attempts = 0;
      _subscription = channel.stream.listen(_onFrame, onError: (_) => _onClosed(channel), onDone: () => _onClosed(channel));
      _heartbeat = Timer.periodic(SocketConfig.heartbeat, (_) => _sendHeartbeat());
    } catch (error) {
      debugPrint('Socket did not open: $error');
      _onClosed(_channel);
    }
  }

  void _onFrame(dynamic raw) {
    try {
      final json = asJson(jsonDecode(raw as String));
      if (json == null) return;
      final event = asString(json['event']);
      if (event == SocketEvents.connected) {
        _set(SocketStatus.connected);
        // Tell the server straight away whether the app is on screen.
        _sendHeartbeat();
      }
      if (event == 'pong' || event.isEmpty) return;
      _messages.add(SocketMessage(event, asJson(json['payload']) ?? const {}));
    } catch (error) {
      debugPrint('Bad socket frame: $error');
    }
  }

  void _onClosed(WebSocketChannel? channel) {
    if (channel != null && channel != _channel) return;
    final code = channel?.closeCode;
    _close();
    if (!_wanted) return;

    if (code != null && SocketConfig.fatalCloseCodes.contains(code)) {
      // 4001: the token is bad — get a fresh one once and try again. 4003: this account may not be here.
      if (code == 4003) {
        _set(SocketStatus.forbidden);
        return;
      }
      unawaited(_renewThenRetry());
      return;
    }
    _scheduleRetry();
  }

  Future<void> _renewThenRetry() async {
    final renewed = await ApiClient.instance.ensureFreshToken();
    if (!_wanted) return;
    if (renewed) {
      unawaited(_connect());
    } else {
      _scheduleRetry();
    }
  }

  void _scheduleRetry() {
    _set(SocketStatus.offline);
    _attempts += 1;
    final base = SocketConfig.reconnectMin.inMilliseconds * pow(2, min(_attempts - 1, 5)).toInt();
    final capped = min(base, SocketConfig.reconnectMax.inMilliseconds);
    // A little jitter so a restart of the server does not bring every phone back in the same second.
    final delay = Duration(milliseconds: capped + _random.nextInt(1000));
    _retry?.cancel();
    _retry = Timer(delay, () {
      _retry = null;
      unawaited(_connect());
    });
  }

  void _sendHeartbeat() {
    final channel = _channel;
    if (channel == null || _status != SocketStatus.connected) return;
    try {
      channel.sink.add(jsonEncode({'type': 'ping', 'foreground': _foreground}));
    } catch (_) {
      // The next close event deals with it.
    }
  }

  void _close() {
    _heartbeat?.cancel();
    _heartbeat = null;
    _subscription?.cancel();
    _subscription = null;
    final channel = _channel;
    _channel = null;
    try {
      channel?.sink.close();
    } catch (_) {}
  }

  void _set(SocketStatus value) {
    if (_status == value) return;
    _status = value;
    _statuses.add(value);
  }
}
