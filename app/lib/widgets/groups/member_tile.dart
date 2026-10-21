import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chant_group.dart';
import 'person_avatar.dart';

/// What the person looking may do to this member.
enum MemberAction { makeAdmin, removeAdmin, remove }

/// One person in the group, with the actions the viewer's role allows.
///
/// An admin may remove an ordinary member or take back an invitation; only the
/// owner touches an admin; nobody touches the owner. The server enforces all of
/// it — this only avoids offering what would be refused.
class MemberTile extends StatelessWidget {
  const MemberTile({
    super.key,
    required this.member,
    required this.myRole,
    required this.isMe,
    required this.onAction,
  });

  final GroupMember member;
  final GroupRole myRole;
  final bool isMe;
  final ValueChanged<MemberAction> onAction;

  List<MemberAction> get _actions {
    if (isMe || member.role == GroupRole.owner || !myRole.isAdmin) return const [];
    final isOwner = myRole == GroupRole.owner;
    return [
      if (!member.isInvited && member.role == GroupRole.member) MemberAction.makeAdmin,
      if (member.role == GroupRole.admin && isOwner) MemberAction.removeAdmin,
      if (member.role != GroupRole.admin || isOwner) MemberAction.remove,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final role = member.isInvited
        ? text.groupRoleInvited
        : switch (member.role) {
            GroupRole.owner => text.groupRoleOwner,
            GroupRole.admin => text.groupRoleAdmin,
            GroupRole.member => text.groupRoleMember,
          };
    final actions = _actions;

    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: PersonAvatar(name: member.name, url: member.avatarUrl, size: AppSizes.avatarMd),
      title: Text(isMe ? text.groupYou : member.name),
      subtitle: Text(role),
      trailing: actions.isEmpty
          ? null
          : PopupMenuButton<MemberAction>(
              icon: Icon(Icons.more_vert_rounded, color: context.colors.onSurfaceVariant),
              onSelected: onAction,
              itemBuilder: (context) => [
                for (final action in actions)
                  PopupMenuItem(
                    value: action,
                    child: Text(switch (action) {
                      MemberAction.makeAdmin => text.groupMakeAdmin,
                      MemberAction.removeAdmin => text.groupRemoveAdmin,
                      MemberAction.remove => member.isInvited ? text.groupCancelInvite : text.groupRemoveMember,
                    }),
                  ),
              ],
            ),
    );
  }
}
