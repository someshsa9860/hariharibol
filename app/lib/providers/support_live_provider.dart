import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/support_config.dart';
import '../models/json.dart';
import '../services/live_socket.dart';
import 'support_provider.dart';

/// Whether the Help screens' line is open right now. The push banner reads it: a reply that arrives over the line
/// is already on screen, so the banner for it is left out. A plain notifier rather than a provider, so the banner
/// (which sits above the router) can read it without a scope.
final ValueNotifier<bool> supportLiveConnected = ValueNotifier(false);

/// The line the Help screens use. A test replaces it with one it drives.
final supportLiveSocketProvider = Provider.autoDispose<LiveSocket>((ref) {
  final socket = LiveSocket();
  // The app coming back to the front reopens a line the system closed meanwhile.
  final lifecycle = AppLifecycleListener(onResume: socket.resume);
  ref.onDispose(() {
    lifecycle.dispose();
    socket.dispose();
  });
  return socket;
});

/// Keeps the reader's tickets current while a support screen is open: a staff reply or a status change refreshes
/// the list and the open conversation without a pull. The screens watch it; the line opens with the first and
/// closes with the last.
final supportLiveProvider = Provider.autoDispose<void>((ref) {
  final socket = ref.watch(supportLiveSocketProvider);

  void mirror() => supportLiveConnected.value = socket.connected.value;
  socket.connected.addListener(mirror);
  mirror();

  final events = socket.events.listen((event) {
    if (event.event != SupportConfig.eventReply && event.event != SupportConfig.eventUpdated) return;
    ref.invalidate(supportTicketsProvider);
    final ticketId = asString(event.payload['ticketId']);
    if (ticketId.isNotEmpty) ref.invalidate(supportTicketProvider(ticketId));
  });
  ref.onDispose(() {
    events.cancel();
    socket.connected.removeListener(mirror);
    supportLiveConnected.value = false;
  });

  socket.start();
});
