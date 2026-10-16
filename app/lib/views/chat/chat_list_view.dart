import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/chat.dart';
import '../../providers/chat_provider.dart';
import '../../widgets/chat/chat_conversation_tile.dart';
import '../../widgets/chat/chat_credit_meter.dart';
import '../../widgets/chat/chat_intro.dart';
import '../../widgets/chat/rename_chat_dialog.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';

/// The reader's conversations with the assistant, newest first. Empty, it
/// introduces the assistant — what it is, and the tradition it answers from.
class ChatListView extends ConsumerStatefulWidget {
  const ChatListView({super.key});

  @override
  ConsumerState<ChatListView> createState() => _ChatListViewState();
}

class _ChatListViewState extends ConsumerState<ChatListView> {
  @override
  void initState() {
    super.initState();
    // The meter is read again each time the list opens.
    Future.microtask(() {
      if (mounted) ref.read(chatStatusProvider.notifier).refresh();
    });
  }

  void _newChat() => AppNavigator.instance.push(AppRoutes.chatNew);

  void _open(ChatConversation conversation) =>
      AppNavigator.instance.push(AppRoutes.chatPath(conversation.id));

  Future<bool> _confirmDelete() {
    final text = AppLocalizations.of(context);
    return AppNavigator.instance.confirm(
      title: text.chatDeleteTitle,
      message: text.chatDeleteBody,
      confirmLabel: text.actionDelete,
      isDestructive: true,
    );
  }

  Future<void> _delete(ChatConversation conversation) async {
    try {
      await ref.read(chatListProvider.notifier).delete(conversation.id);
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    }
  }

  Future<void> _rename(ChatConversation conversation) async {
    final name = await askChatName(context, current: conversation.title);
    if (name == null || name == conversation.title) return;
    try {
      await ref.read(chatListProvider.notifier).rename(conversation.id, name);
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final status = ref.watch(chatStatusProvider);
    final list = ref.watch(chatListProvider);
    final credits = status.value?.credits;

    return Scaffold(
      appBar: AppBar(
        title: Text(text.chatTitle),
        bottom: credits == null
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(ChatCreditMeter.extent),
                child: ChatCreditMeter(credits: credits),
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _newChat,
        icon: const Icon(Icons.add_rounded),
        label: Text(text.chatNewChat),
      ),
      body: list.when(
        skipLoadingOnReload: true,
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
          onRetry: () => ref.read(chatListProvider.notifier).refresh(),
        ),
        data: (data) {
          if (data.items.isEmpty) {
            return ChatIntro(
              description: status.value?.description ?? '',
              action: FilledButton(onPressed: _newChat, child: Text(text.chatNewChat)),
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.read(chatListProvider.notifier).refresh(),
            child: NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification.metrics.extentAfter < AppSizes.coverHeight) {
                  ref.read(chatListProvider.notifier).loadMore();
                }
                return false;
              },
              child: ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                // Clears the new-chat button.
                padding: const EdgeInsets.only(bottom: AppSizes.buttonHeight + AppSpacing.xxxl),
                itemCount: data.items.length,
                separatorBuilder: (_, _) => const Divider(),
                itemBuilder: (context, index) {
                  final conversation = data.items[index];
                  return ChatConversationTile(
                    conversation: conversation,
                    onOpen: () => _open(conversation),
                    onRename: () => _rename(conversation),
                    onDelete: () => _delete(conversation),
                    confirmDelete: _confirmDelete,
                  );
                },
              ),
            ),
          );
        },
      ),
    );
  }
}
