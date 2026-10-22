import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/time_format.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/ticket.dart';
import '../../providers/session_provider.dart';
import '../../providers/tickets_provider.dart';
import '../../widgets/common/error_panel.dart';
import '../../widgets/common/person_avatar.dart';

/// The support desk's tickets and feedback, for an account that holds `support.manage`.
class TicketsView extends ConsumerStatefulWidget {
  const TicketsView({super.key});

  @override
  ConsumerState<TicketsView> createState() => _TicketsViewState();
}

class _TicketsViewState extends ConsumerState<TicketsView> {
  TicketFilter _filter = TicketFilter.open;

  String _label(AppLocalizations text, TicketFilter filter) => switch (filter) {
        TicketFilter.open => text.ticketFilterOpen,
        TicketFilter.inProgress => text.ticketFilterProgress,
        TicketFilter.resolved => text.ticketFilterResolved,
        TicketFilter.feedback => text.ticketFilterFeedback,
      };

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final canManage = ref.watch(canManageSupportProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.tabTickets)),
      body: !canManage
          ? EmptyPanel(icon: Icons.lock_outline, message: text.ticketsNoAccess)
          : Column(
              children: [
                SizedBox(
                  height: 52,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter, vertical: AppSpacing.sm),
                    children: [
                      for (final filter in TicketFilter.values)
                        Padding(
                          padding: const EdgeInsets.only(right: AppSpacing.sm),
                          child: ChoiceChip(
                            label: Text(_label(text, filter)),
                            selected: _filter == filter,
                            onSelected: (_) => setState(() => _filter = filter),
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(child: _List(filter: _filter)),
              ],
            ),
    );
  }
}

class _List extends ConsumerWidget {
  const _List({required this.filter});

  final TicketFilter filter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final tickets = ref.watch(ticketsProvider(filter));

    return tickets.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => ErrorPanel(error: error, onRetry: () => ref.invalidate(ticketsProvider(filter))),
      data: (state) {
        if (state.items.isEmpty) return EmptyPanel(icon: Icons.inbox_outlined, message: text.ticketsEmpty);
        return RefreshIndicator(
          onRefresh: () => ref.read(ticketsProvider(filter).notifier).refresh(),
          child: ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            itemCount: state.items.length,
            separatorBuilder: (context, index) => const Divider(height: 1),
            itemBuilder: (context, index) {
              if (index == state.items.length - 3) ref.read(ticketsProvider(filter).notifier).loadMore().ignore();
              final ticket = state.items[index];
              return ListTile(
                leading: PersonAvatar(person: ticket.person),
                title: Text(
                  ticket.isFeedback
                      ? text.ticketFeedbackTitle(ticket.rating ?? 0)
                      : (ticket.subject ?? ticket.category),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: ticket.awaitingStaff ? const TextStyle(fontWeight: FontWeight.w700) : null,
                ),
                subtitle: Text(
                  '${ticket.person.displayName} · ${ticket.preview ?? ''}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(whenText(text, locale, ticket.lastMessageAt), style: Theme.of(context).textTheme.labelSmall),
                    if (ticket.awaitingStaff) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Icon(Icons.circle, size: 10, color: Theme.of(context).colorScheme.primary),
                    ],
                  ],
                ),
                onTap: () => context.push(AppRoutes.ticket(ticket.id)),
              );
            },
          ),
        );
      },
    );
  }
}

/// How a ticket's status reads.
String ticketStatusText(AppLocalizations text, Ticket ticket) => switch (ticket.status) {
      'IN_PROGRESS' => text.ticketFilterProgress,
      'RESOLVED' => text.ticketFilterResolved,
      _ => text.ticketFilterOpen,
    };
