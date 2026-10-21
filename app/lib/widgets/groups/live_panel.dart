import 'dart:async';

import 'package:flutter/material.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/chant_group.dart';
import '../../services/group_live_room.dart';
import '../../services/group_service.dart';
import 'person_avatar.dart';

/// The group's voice room: who is chanting, and the buttons to start, join,
/// mute, leave and end it. Owns the [GroupLiveRoom] for as long as this phone
/// is in the room; leaving the screen leaves the room.
class LivePanel extends StatefulWidget {
  const LivePanel({super.key, required this.group, required this.myId, required this.onChanged});

  final ChantGroup group;
  final String myId;

  /// The room opened, closed or changed in a way the screen should read again.
  final VoidCallback onChanged;

  @override
  State<LivePanel> createState() => _LivePanelState();
}

class _LivePanelState extends State<LivePanel> {
  GroupLiveRoom? _room;
  bool _busy = false;

  @override
  void dispose() {
    final room = _room;
    if (room != null) {
      unawaited(room.leave().whenComplete(room.dispose));
      unawaited(WakelockPlus.disable());
    }
    super.dispose();
  }

  Future<void> _enter({required bool start}) async {
    final text = AppLocalizations.of(context);
    setState(() => _busy = true);
    final room = GroupLiveRoom(groupId: widget.group.id, me: widget.myId);
    try {
      await room.enter(start: start);
      room.onClosed = _afterRoomClosed;
      // A locked screen stops the microphone on most phones.
      unawaited(WakelockPlus.enable());
      if (!mounted) {
        unawaited(room.leave().whenComplete(room.dispose));
        return;
      }
      setState(() => _room = room);
      widget.onChanged();
    } on ApiFailure catch (failure) {
      room.dispose();
      if (failure.statusCode == 410) {
        AppNavigator.instance.showMessage(text.liveClosed);
        widget.onChanged();
      } else if (failure.kind == FailureKind.conflict) {
        AppNavigator.instance.showMessage(text.liveFull);
      } else {
        AppNavigator.instance.showFailure(failure);
      }
    } on Object {
      // The microphone: refused, or none to be had.
      room.dispose();
      AppNavigator.instance.showMessage(text.liveMicDenied);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _afterRoomClosed() {
    unawaited(WakelockPlus.disable());
    _room?.dispose();
    if (mounted) setState(() => _room = null);
    widget.onChanged();
  }

  Future<void> _leave() async {
    final room = _room;
    if (room == null) return;
    setState(() => _room = null);
    await room.leave();
    room.dispose();
    unawaited(WakelockPlus.disable());
    widget.onChanged();
  }

  Future<void> _end() async {
    final text = AppLocalizations.of(context);
    final sure = await AppNavigator.instance.confirm(
      title: text.liveHeading,
      message: text.liveEndConfirm,
      confirmLabel: text.liveEnd,
      isDestructive: true,
    );
    if (!sure) return;
    try {
      await GroupService.instance.endRoom(widget.group.id);
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    }
    // The server tells everyone, this phone included, over the socket; if the
    // socket is down the next heartbeat finds out.
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final room = _room;
    final isAdmin = widget.group.myRole.isAdmin;
    final live = widget.group.live;

    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: room == null
            ? _outside(context, text, isAdmin: isAdmin, live: live)
            : ListenableBuilder(
                listenable: room,
                builder: (context, _) => _inside(context, text, room, isAdmin: isAdmin),
              ),
      ),
    );
  }

  Widget _outside(BuildContext context, AppLocalizations text, {required bool isAdmin, required LiveRoomState? live}) {
    final others = [for (final p in live?.participants ?? const <GroupPerson>[]) if (p.id != widget.myId) p];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _heading(context, text, live: live != null),
        if (live != null) ...[
          const SizedBox(height: AppSpacing.md),
          for (final person in others)
            _row(context, name: person.name, url: person.avatarUrl, status: text.liveInRoom),
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(
            onPressed: _busy ? null : () => _enter(start: false),
            icon: const Icon(Icons.mic_rounded),
            label: Text(text.liveJoin),
          ),
        ] else ...[
          const SizedBox(height: AppSpacing.sm),
          Text(isAdmin ? text.liveIdleAdmin : text.liveIdleMember, style: context.texts.bodyMedium),
          if (isAdmin) ...[
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              onPressed: _busy ? null : () => _enter(start: true),
              icon: const Icon(Icons.mic_rounded),
              label: Text(text.liveStart),
            ),
          ],
        ],
      ],
    );
  }

  Widget _inside(BuildContext context, AppLocalizations text, GroupLiveRoom room, {required bool isAdmin}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _heading(context, text, live: true),
        const SizedBox(height: AppSpacing.md),
        _row(context, name: text.groupYou, status: room.muted ? text.liveMuted : text.liveChanting),
        for (final peer in room.peers)
          _row(
            context,
            name: peer.person.name,
            url: peer.person.avatarUrl,
            status: switch (peer.state) {
              PeerState.connecting => text.liveConnecting,
              PeerState.connected => text.liveChanting,
              PeerState.failed => text.liveLost,
            },
          ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.sm,
          children: [
            OutlinedButton.icon(
              onPressed: () => room.setMuted(!room.muted),
              icon: Icon(room.muted ? Icons.mic_off_rounded : Icons.mic_rounded),
              label: Text(room.muted ? text.liveUnmute : text.liveMute),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: context.colors.error,
                foregroundColor: context.colors.onError,
              ),
              onPressed: _leave,
              child: Text(text.liveLeave),
            ),
            if (isAdmin) TextButton(onPressed: _end, child: Text(text.liveEnd)),
          ],
        ),
      ],
    );
  }

  Widget _heading(BuildContext context, AppLocalizations text, {required bool live}) {
    return Row(
      children: [
        Icon(live ? Icons.graphic_eq_rounded : Icons.mic_none_rounded, color: context.colors.primary),
        const SizedBox(width: AppSpacing.sm),
        Text(live ? text.liveNow : text.liveHeading, style: context.texts.titleMedium),
      ],
    );
  }

  Widget _row(BuildContext context, {required String name, String? url, required String status}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          PersonAvatar(name: name, url: url),
          const SizedBox(width: AppSpacing.md),
          Expanded(child: Text(name, style: context.texts.bodyLarge)),
          Text(status, style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant)),
        ],
      ),
    );
  }
}
