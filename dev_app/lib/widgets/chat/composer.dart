import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';

/// The box at the bottom of a conversation or a ticket. [onSend] gets the trimmed text; the box clears at once.
class Composer extends StatefulWidget {
  const Composer({super.key, required this.onSend, this.maxLength = 2000});

  final Future<void> Function(String text) onSend;
  final int maxLength;

  @override
  State<Composer> createState() => _ComposerState();
}

class _ComposerState extends State<Composer> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _send() {
    final value = _controller.text.trim();
    if (value.isEmpty) return;
    _controller.clear();
    widget.onSend(value);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.sm, AppSpacing.sm),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                minLines: 1,
                maxLines: 5,
                maxLength: widget.maxLength,
                buildCounter: (context, {required currentLength, required isFocused, required maxLength}) => null,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(hintText: text.chatComposerHint),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            IconButton.filled(
              tooltip: text.chatSend,
              onPressed: _send,
              icon: const Icon(Icons.send),
            ),
          ],
        ),
      ),
    );
  }
}
