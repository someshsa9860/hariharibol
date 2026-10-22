import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/chant_format.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/support.dart';
import '../../providers/developer_chat_provider.dart';
import '../../providers/support_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/support/feedback_sheet.dart';
import '../../widgets/support/star_rating.dart';
import '../../widgets/support/support_labels.dart';
import '../../widgets/support/ticket_sheet.dart';

/// Help and feedback: write to us, and see what we answered.
class SupportView extends ConsumerWidget {
  const SupportView({super.key});

  Future<void> _write(BuildContext context, WidgetRef ref, Future<bool> Function(BuildContext) open) async {
    final sent = await open(context);
    if (sent) ref.invalidate(supportTicketsProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final tickets = ref.watch(supportTicketsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.supportTitle, style: context.texts.headlineSmall)),
      body: tickets.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
          onRetry: () async => ref.refresh(supportTicketsProvider.future),
        ),
        data: (page) => RefreshIndicator(
          onRefresh: () async => ref.refresh(supportTicketsProvider.future),
          child: ListView(
            padding: AppSpacing.page,
            children: [
              const _DeveloperChatEntry(),
              const SizedBox(height: AppSpacing.md),
              FilledButton.icon(
                onPressed: () => _write(context, ref, TicketSheet.show),
                icon: const Icon(Icons.support_agent_rounded),
                label: Text(text.supportRaiseTicket),
                style: FilledButton.styleFrom(minimumSize: const Size(0, AppSizes.buttonHeight)),
              ),
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton.icon(
                onPressed: () => _write(context, ref, FeedbackSheet.show),
                icon: const Icon(Icons.star_outline_rounded),
                label: Text(text.supportSendFeedback),
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, AppSizes.buttonHeight)),
              ),
              const SizedBox(height: AppSpacing.xl),
              Text(text.supportMyTickets, style: context.texts.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              if (page.items.isEmpty)
                EmptyState(message: text.supportEmpty, icon: Icons.forum_outlined)
              else
                for (final ticket in page.items) _TicketTile(ticket: ticket),
            ],
          ),
        ),
      ),
    );
  }
}

/// The way into the chat with the developer, with a count of replies not yet read.
class _DeveloperChatEntry extends ConsumerWidget {
  const _DeveloperChatEntry();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final unread = ref.watch(developerUnreadProvider).value ?? 0;

    return Card(
      child: ListTile(
        leading: const Icon(Icons.forum_rounded),
        title: Text(text.developerChatTitle, style: context.texts.titleSmall),
        subtitle: Text(text.developerChatSubtitle),
        trailing: unread > 0 ? Badge(label: Text('$unread')) : const Icon(Icons.chevron_right_rounded),
        onTap: () async {
          await AppNavigator.instance.push(AppRoutes.developerChat);
          ref.invalidate(developerUnreadProvider);
        },
      ),
    );
  }
}

class _TicketTile extends ConsumerWidget {
  const _TicketTile({required this.ticket});

  final SupportTicket ticket;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final when = ticket.lastMessageAt;

    return Card(
      child: ListTile(
        onTap: () async {
          await AppNavigator.instance.push(AppRoutes.ticketPath(ticket.id));
          ref.invalidate(supportTicketsProvider);
        },
        title: Text(
          ticket.preview.isEmpty ? supportCategoryLabel(text, ticket.category) : ticket.preview,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: ticket.hasUnreadReply ? context.texts.titleSmall : context.texts.bodyLarge,
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: AppSpacing.xs),
          child: Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (ticket.isFeedback && ticket.rating != null) StarRating(value: ticket.rating!, size: AppSizes.iconSm)
              else Text(supportStatusLabel(text, ticket.status), style: context.texts.labelMedium),
              if (when != null) Text(formatDateTime(context, when), style: context.texts.bodySmall),
            ],
          ),
        ),
        // The dot is the cue; a reply waiting also reads in bold.
        trailing: ticket.hasUnreadReply
            ? Icon(Icons.circle, size: AppSizes.iconSm / 2, color: context.colors.primary)
            : const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}
