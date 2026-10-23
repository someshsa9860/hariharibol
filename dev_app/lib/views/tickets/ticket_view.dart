import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/failure_text.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../providers/tickets_provider.dart';
import '../../widgets/chat/composer.dart';
import '../../widgets/chat/message_bubble.dart';
import '../../widgets/common/error_panel.dart';
import '../../widgets/common/person_avatar.dart';

/// One ticket (or piece of feedback): the thread, a reply box, and its status.
class TicketView extends ConsumerWidget {
  const TicketView({super.key, required this.ticketId});

  final String ticketId;

  Future<void> _run(BuildContext context, Future<void> Function() action) async {
    final text = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
    } on ApiFailure catch (failure) {
      messenger.showSnackBar(SnackBar(content: Text(failure.describe(text))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final detail = ref.watch(ticketDetailProvider(ticketId));
    final notifier = ref.read(ticketDetailProvider(ticketId).notifier);

    return Scaffold(
      appBar: AppBar(
        title: Text(detail.maybeWhen(
          data: (d) => d.ticket.isFeedback ? text.ticketFeedbackTitle(d.ticket.rating ?? 0) : (d.ticket.subject ?? d.ticket.category),
          orElse: () => text.tabTickets,
        )),
        actions: [
          detail.maybeWhen(
            data: (d) => PopupMenuButton<String>(
              tooltip: text.ticketSetStatus,
              icon: const Icon(Icons.flag_outlined),
              onSelected: (status) => _run(context, () => notifier.setStatus(status)),
              itemBuilder: (context) => [
                PopupMenuItem(value: 'OPEN', child: Text(text.ticketFilterOpen)),
                PopupMenuItem(value: 'IN_PROGRESS', child: Text(text.ticketFilterProgress)),
                PopupMenuItem(value: 'RESOLVED', child: Text(text.ticketFilterResolved)),
              ],
            ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorPanel(error: error, onRetry: () => ref.invalidate(ticketDetailProvider(ticketId))),
        data: (d) => Column(
          children: [
            ListTile(
              leading: PersonAvatar(person: d.ticket.person),
              title: Text(d.ticket.person.displayName),
              subtitle: Text('${d.ticket.person.email} · ${d.ticket.category}'),
              trailing: Chip(label: Text(switch (d.ticket.status) {
                'IN_PROGRESS' => text.ticketFilterProgress,
                'RESOLVED' => text.ticketFilterResolved,
                _ => text.ticketFilterOpen,
              })),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                children: [
                  if (d.screenshotUrl != null)
                    Padding(
                      padding: const EdgeInsets.all(AppSpacing.gutter),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(AppSpacing.radius),
                        child: Image.network(d.screenshotUrl!, height: 220, fit: BoxFit.cover),
                      ),
                    ),
                  for (final message in d.messages)
                    MessageBubble(body: message.body, createdAt: message.createdAt, mine: message.fromStaff),
                ],
              ),
            ),
            Composer(maxLength: 4000, onSend: (value) => _run(context, () => notifier.reply(value))),
          ],
        ),
      ),
    );
  }
}
