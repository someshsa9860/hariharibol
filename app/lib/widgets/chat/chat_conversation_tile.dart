import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chat.dart';

/// One row of the conversation list. Swipe to delete; press and hold for
/// rename and delete (a swipe is not discoverable and not available to
/// everyone, so the menu is the other way to everything).
class ChatConversationTile extends StatelessWidget {
  const ChatConversationTile({
    super.key,
    required this.conversation,
    required this.onOpen,
    required this.onRename,
    required this.onDelete,
    required this.confirmDelete,
  });

  final ChatConversation conversation;
  final VoidCallback onOpen;
  final VoidCallback onRename;
  final VoidCallback onDelete;

  /// Asked before a swipe deletes; the menu's Delete asks for itself.
  final Future<bool> Function() confirmDelete;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final when = conversation.lastMessageAt;
    final locale = Localizations.localeOf(context).toString();

    return Dismissible(
      key: ValueKey('chat-${conversation.id}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) => confirmDelete(),
      onDismissed: (_) => onDelete(),
      background: Container(
        alignment: AlignmentDirectional.centerEnd,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
        color: context.colors.errorContainer,
        child: Icon(Icons.delete_outline_rounded, color: context.colors.onErrorContainer),
      ),
      child: ListTile(
        onTap: onOpen,
        onLongPress: () => _menu(context),
        title: Text(conversation.title, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: when == null ? null : Text(DateFormat.MMMd(locale).add_jm().format(when)),
        trailing: PopupMenuButton<_Action>(
          tooltip: text.chatMoreActions,
          onSelected: (action) => switch (action) {
            _Action.rename => onRename(),
            _Action.delete => _confirmAndDelete(),
          },
          itemBuilder: (_) => [
            PopupMenuItem(value: _Action.rename, child: Text(text.chatMenuRename)),
            PopupMenuItem(value: _Action.delete, child: Text(text.actionDelete)),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmAndDelete() async {
    if (await confirmDelete()) onDelete();
  }

  Future<void> _menu(BuildContext context) async {
    final text = AppLocalizations.of(context);
    final action = await showModalBottomSheet<_Action>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: Text(text.chatMenuRename),
              onTap: () => Navigator.of(sheet).pop(_Action.rename),
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded),
              title: Text(text.actionDelete),
              onTap: () => Navigator.of(sheet).pop(_Action.delete),
            ),
          ],
        ),
      ),
    );
    switch (action) {
      case _Action.rename:
        onRename();
      case _Action.delete:
        await _confirmAndDelete();
      case null:
        break;
    }
  }
}

enum _Action { rename, delete }
