import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/chant_group.dart';
import '../../providers/group_provider.dart';
import '../../services/group_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/groups/new_group_sheet.dart';

/// Chanting groups: the ones the person is in, and the invitations waiting.
class GroupsView extends ConsumerWidget {
  const GroupsView({super.key});

  Future<void> _answer(WidgetRef ref, String groupId, {required bool accept}) async {
    try {
      final service = GroupService.instance;
      await (accept ? service.accept(groupId) : service.decline(groupId));
      ref.invalidate(groupListProvider);
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final groups = ref.watch(groupListProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.groupsTitle)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final made = await showNewGroupSheet(context);
          if (made == true) ref.invalidate(groupListProvider);
        },
        icon: const Icon(Icons.add_rounded),
        label: Text(text.groupsNew),
      ),
      body: groups.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
          onRetry: () async => ref.invalidate(groupListProvider),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async => ref.refresh(groupListProvider.future),
          child: _body(context, ref, text, data),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, WidgetRef ref, AppLocalizations text, GroupList data) {
    if (data.groups.isEmpty && data.invitations.isEmpty) {
      return ListView(children: [
        const SizedBox(height: AppSpacing.xxxl),
        EmptyState(message: text.groupsEmpty, icon: Icons.groups_rounded),
      ]);
    }

    return ListView(
      padding: AppSpacing.page,
      children: [
        if (data.invitations.isNotEmpty) ...[
          Text(text.groupsInvitations, style: context.texts.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          for (final invite in data.invitations)
            Card(
              child: Padding(
                padding: AppSpacing.card,
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(invite.name, style: context.texts.titleSmall),
                          Text(
                            invite.invitedBy == null
                                ? text.groupInvitedGeneric
                                : text.groupInvitedBy(invite.invitedBy!),
                            style: context.texts.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => _answer(ref, invite.groupId, accept: false),
                      child: Text(text.groupDecline),
                    ),
                    FilledButton(
                      style: FilledButton.styleFrom(minimumSize: const Size(0, AppSizes.buttonHeightSm)),
                      onPressed: () => _answer(ref, invite.groupId, accept: true),
                      child: Text(text.groupJoin),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: AppSpacing.lg),
        ],
        for (final group in data.groups)
          Card(
            clipBehavior: Clip.antiAlias,
            child: ListTile(
              contentPadding: AppSpacing.card,
              onTap: () => AppNavigator.instance.push(AppRoutes.groupPath(group.id)),
              leading: Icon(Icons.groups_rounded, size: AppSizes.iconLg, color: context.colors.primary),
              title: Text(group.name),
              subtitle: Text(
                [
                  text.groupMembersCount(group.memberCount),
                  if (group.mantraName != null) group.mantraName!,
                ].join(' · '),
              ),
              trailing: group.live == null
                  ? const Icon(Icons.chevron_right_rounded)
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.graphic_eq_rounded, color: context.colors.primary),
                        const SizedBox(width: AppSpacing.xs),
                        Text(text.liveNow, style: context.texts.labelMedium),
                      ],
                    ),
            ),
          ),
      ],
    );
  }
}
