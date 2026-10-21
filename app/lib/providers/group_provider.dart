import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/chant_group.dart';
import '../services/group_service.dart';
import '../services/realtime_service.dart';

/// What the server says changed about groups: an invitation, a room opening or
/// closing, a member coming or going. Each is a reason to read again.
const _reasons = {'group.invited', 'group.live', 'group.changed'};

/// The signed-in person's groups and invitations, read again whenever the
/// realtime socket reports a change — so a room that opens elsewhere shows here
/// without pulling to refresh.
final groupListProvider = FutureProvider.autoDispose<GroupList>((ref) {
  final realtime = RealtimeService.instance..retain();
  final changes = realtime.events.where((event) => _reasons.contains(event.name)).listen((_) => ref.invalidateSelf());
  ref.onDispose(() {
    unawaited(changes.cancel());
    realtime.release();
  });
  return GroupService.instance.list();
});

/// One group with its members. A change to *this* group reads it again; a
/// removal or deletion is left to the screen, which sends the person away.
final groupProvider = FutureProvider.autoDispose.family<ChantGroup, String>((ref, id) {
  final realtime = RealtimeService.instance..retain();
  final changes = realtime.events
      .where((event) => _reasons.contains(event.name) && event.payload['groupId'] == id)
      .where((event) => event.payload['what'] != 'deleted' && event.payload['what'] != 'removed')
      .listen((_) => ref.invalidateSelf());
  ref.onDispose(() {
    unawaited(changes.cancel());
    realtime.release();
  });
  return GroupService.instance.read(id);
});
