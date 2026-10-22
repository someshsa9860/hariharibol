import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/socket_service.dart';

final socketServiceProvider = Provider<SocketService>((ref) => SocketService.instance);

/// The line's state, for the "live / reconnecting" dot.
final socketStatusProvider = StreamProvider<SocketStatus>((ref) async* {
  final socket = ref.watch(socketServiceProvider);
  yield socket.status;
  yield* socket.statuses;
});

/// Every event the server sends.
final socketMessagesProvider = StreamProvider<SocketMessage>((ref) => ref.watch(socketServiceProvider).messages);
