import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../l10n/generated/app_localizations.dart';

/// Asks for a new name for a chat. Returns it trimmed, or null if the reader
/// backs out or leaves it empty.
Future<String?> askChatName(BuildContext context, {required String current}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _RenameChatDialog(current: current),
  );
}

class _RenameChatDialog extends StatefulWidget {
  const _RenameChatDialog({required this.current});

  final String current;

  @override
  State<_RenameChatDialog> createState() => _RenameChatDialogState();
}

class _RenameChatDialogState extends State<_RenameChatDialog> {
  late final TextEditingController _name = TextEditingController(text: widget.current);

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _save() {
    final name = _name.text.trim();
    Navigator.of(context).pop(name.isEmpty ? null : name);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return AlertDialog(
      title: Text(text.chatRenameTitle),
      content: TextField(
        controller: _name,
        autofocus: true,
        maxLength: ChatConfig.titleMaxChars,
        textInputAction: TextInputAction.done,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: text.chatRenameHint),
        onSubmitted: (_) => _save(),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(text.actionCancel)),
        TextButton(onPressed: _save, child: Text(text.actionSave)),
      ],
    );
  }
}
