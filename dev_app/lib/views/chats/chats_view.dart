import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/time_format.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/chat_provider.dart';
import '../../widgets/common/error_panel.dart';
import '../../widgets/common/person_avatar.dart';
import '../../widgets/live/connection_dot.dart';

/// Conversations with readers, latest first; unread ones in bold with a count.
class ChatsView extends ConsumerWidget {
  const ChatsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final conversations = ref.watch(conversationsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.tabChats), actions: const [ConnectionDot()]),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(AppRoutes.newChat),
        icon: const Icon(Icons.edit_outlined),
        label: Text(text.chatNew),
      ),
      body: conversations.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorPanel(error: error, onRetry: () => ref.invalidate(conversationsProvider)),
        data: (items) {
          if (items.isEmpty) return EmptyPanel(icon: Icons.chat_bubble_outline, message: text.chatsEmpty);
          return RefreshIndicator(
            onRefresh: () => ref.read(conversationsProvider.notifier).refresh(),
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (context, index) {
                if (index == items.length - 3) ref.read(conversationsProvider.notifier).loadMore().ignore();
                final conversation = items[index];
                final unread = conversation.unread > 0;
                return ListTile(
                  leading: PersonAvatar(person: conversation.person),
                  title: Text(
                    conversation.person.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: unread ? const TextStyle(fontWeight: FontWeight.w700) : null,
                  ),
                  subtitle: Text(conversation.lastMessagePreview ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(whenText(text, locale, conversation.lastMessageAt), style: Theme.of(context).textTheme.labelSmall),
                      if (unread) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Badge(label: Text('${conversation.unread}')),
                      ],
                    ],
                  ),
                  onTap: () => context.push(AppRoutes.chat(conversation.id)),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
