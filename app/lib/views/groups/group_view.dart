import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/chant_group.dart';
import '../../providers/group_provider.dart';
import '../../providers/session_provider.dart';
import '../../services/group_service.dart';
import '../../services/realtime_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/groups/invite_field.dart';
import '../../widgets/groups/live_panel.dart';
import '../../widgets/groups/member_tile.dart';

/// One group: its voice room, its people, and what the viewer's role allows.
class GroupView extends ConsumerStatefulWidget {
  const GroupView({super.key, required this.groupId});

  final String groupId;

  @override
  ConsumerState<GroupView> createState() => _GroupViewState();
}

class _GroupViewState extends ConsumerState<GroupView> {
  StreamSubscription<RealtimeEvent>? _events;

  @override
  void initState() {
    super.initState();
    // Being removed, or the group being deleted, sends the person back to the list.
    RealtimeService.instance.retain();
    _events = RealtimeService.instance.events.listen(_onEvent);
  }

  @override
  void dispose() {
    unawaited(_events?.cancel());
    RealtimeService.instance.release();
    super.dispose();
  }

  void _onEvent(RealtimeEvent event) {
    if (event.name != 'group.changed' || event.payload['groupId'] != widget.groupId) return;
    final what = event.payload['what'];
    if (what != 'deleted' && what != 'removed') return;

    final text = AppLocalizations.of(context);
    AppNavigator.instance.showMessage(what == 'deleted' ? text.groupWasDeleted : text.groupWasRemoved);
    AppNavigator.instance.pop();
  }

  void _reload() => ref.invalidate(groupProvider(widget.groupId));

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
      _reload();
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    }
  }

  Future<void> _onMemberAction(ChantGroup group, GroupMember member, MemberAction action) async {
    final text = AppLocalizations.of(context);
    final service = GroupService.instance;

    switch (action) {
      case MemberAction.makeAdmin:
        await _run(() => service.setRole(group.id, member.id, GroupRole.admin));
      case MemberAction.removeAdmin:
        await _run(() => service.setRole(group.id, member.id, GroupRole.member));
      case MemberAction.remove:
        final sure = await AppNavigator.instance.confirm(
          title: member.isInvited ? text.groupCancelInvite : text.groupRemoveMember,
          message: member.isInvited ? text.groupCancelInviteConfirm : text.groupRemoveConfirm(member.name),
          isDestructive: true,
        );
        if (sure) await _run(() => service.removeMember(group.id, member.id));
    }
  }

  Future<void> _leave(ChantGroup group) async {
    final text = AppLocalizations.of(context);
    final sure = await AppNavigator.instance.confirm(
      title: text.groupLeave,
      message: text.groupLeaveConfirm,
      confirmLabel: text.groupLeave,
      isDestructive: true,
    );
    if (!sure) return;
    try {
      await GroupService.instance.leave(group.id);
      ref.invalidate(groupListProvider);
      AppNavigator.instance.pop();
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    }
  }

  Future<void> _delete(ChantGroup group) async {
    final text = AppLocalizations.of(context);
    final sure = await AppNavigator.instance.confirm(
      title: text.groupDelete,
      message: text.groupDeleteConfirm(group.name),
      confirmLabel: text.groupDelete,
      isDestructive: true,
    );
    if (!sure) return;
    try {
      await GroupService.instance.delete(group.id);
      ref.invalidate(groupListProvider);
      AppNavigator.instance.pop();
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final group = ref.watch(groupProvider(widget.groupId));
    final me = ref.watch(currentUserProvider)?.id;

    return Scaffold(
      appBar: AppBar(title: Text(group.value?.name ?? text.groupsTitle)),
      body: group.when(
        loading: () => const AppLoader(),
        error: (error, _) {
          final failure = error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown);
          if (failure.kind == FailureKind.notFound) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Text(text.groupNotFound, textAlign: TextAlign.center),
              ),
            );
          }
          return AppErrorView(failure: failure, onRetry: () async => _reload());
        },
        data: (data) => me == null ? const AppLoader() : _body(context, text, data, me),
      ),
    );
  }

  Widget _body(BuildContext context, AppLocalizations text, ChantGroup group, String me) {
    final active = [for (final m in group.members) if (!m.isInvited) m];
    final waiting = [for (final m in group.members) if (m.isInvited) m];

    return ListView(
      padding: AppSpacing.page,
      children: [
        if (group.description != null) ...[
          Text(group.description!, style: context.texts.bodyMedium),
          const SizedBox(height: AppSpacing.md),
        ],
        if (group.mantraName != null) ...[
          Row(children: [
            Icon(Icons.self_improvement_rounded, size: AppSizes.iconSm, color: context.colors.primary),
            const SizedBox(width: AppSpacing.xs),
            Text(group.mantraName!, style: context.texts.labelLarge),
          ]),
          const SizedBox(height: AppSpacing.md),
        ],
        LivePanel(group: group, myId: me, onChanged: _reload),
        const SizedBox(height: AppSpacing.xl),
        Text('${text.groupPeopleHeading} · ${active.length}', style: context.texts.titleMedium),
        if (group.myRole.isAdmin) ...[
          const SizedBox(height: AppSpacing.md),
          InviteField(groupId: group.id, onInvited: _reload),
        ],
        const SizedBox(height: AppSpacing.sm),
        for (final member in active)
          MemberTile(
            member: member,
            myRole: group.myRole,
            isMe: member.id == me,
            onAction: (action) => _onMemberAction(group, member, action),
          ),
        if (waiting.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          Text(text.groupWaitingHeading, style: context.texts.titleSmall),
          for (final member in waiting)
            MemberTile(
              member: member,
              myRole: group.myRole,
              isMe: false,
              onAction: (action) => _onMemberAction(group, member, action),
            ),
        ],
        const SizedBox(height: AppSpacing.xl),
        if (group.myRole == GroupRole.owner)
          OutlinedButton.icon(
            onPressed: () => _delete(group),
            style: OutlinedButton.styleFrom(foregroundColor: context.colors.error),
            icon: const Icon(Icons.delete_outline_rounded),
            label: Text(text.groupDelete),
          )
        else ...[
          OutlinedButton.icon(
            onPressed: () => _leave(group),
            icon: const Icon(Icons.logout_rounded),
            label: Text(text.groupLeave),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(text.groupOnlyOwnerDeletes, style: context.texts.bodySmall),
        ],
      ],
    );
  }
}
