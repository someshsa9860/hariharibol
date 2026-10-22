import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/failure_text.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/dev_message.dart';
import '../../providers/chat_provider.dart';
import '../../services/dev_service.dart';
import '../../widgets/common/error_panel.dart';
import '../../widgets/common/person_avatar.dart';

/// Find a reader and write to them first. If a conversation with them exists it is simply continued.
class NewChatView extends ConsumerStatefulWidget {
  const NewChatView({super.key});

  @override
  ConsumerState<NewChatView> createState() => _NewChatViewState();
}

class _NewChatViewState extends ConsumerState<NewChatView> {
  final TextEditingController _query = TextEditingController();
  Timer? _debounce;
  String _term = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => setState(() => _term = value.trim()));
  }

  Future<void> _write(ChatPerson person) async {
    final text = AppLocalizations.of(context);
    final body = await showDialog<String>(
      context: context,
      builder: (context) => _FirstMessageDialog(person: person),
    );
    if (body == null || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      final id = await DevService.instance.startConversation(person.id, body);
      ref.invalidate(conversationsProvider);
      router.go(AppRoutes.chats);
      router.push(AppRoutes.chat(id));
    } on ApiFailure catch (failure) {
      messenger.showSnackBar(SnackBar(content: Text(failure.describe(text))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final results = ref.watch(readerSearchProvider(_term));

    return Scaffold(
      appBar: AppBar(title: Text(text.chatNew)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.gutter),
            child: TextField(
              controller: _query,
              autofocus: true,
              onChanged: _onChanged,
              decoration: InputDecoration(hintText: text.chatSearchHint, prefixIcon: const Icon(Icons.search)),
            ),
          ),
          Expanded(
            child: _term.length < 2
                ? EmptyPanel(icon: Icons.person_search_outlined, message: text.chatSearchPrompt)
                : results.when(
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (error, _) => ErrorPanel(error: error, onRetry: () => ref.invalidate(readerSearchProvider(_term))),
                    data: (people) => people.isEmpty
                        ? EmptyPanel(icon: Icons.person_off_outlined, message: text.chatNoResults)
                        : ListView.separated(
                            itemCount: people.length,
                            separatorBuilder: (context, index) => const Divider(height: 1),
                            itemBuilder: (context, index) => ListTile(
                              leading: PersonAvatar(person: people[index]),
                              title: Text(people[index].displayName),
                              subtitle: Text(people[index].email),
                              onTap: () => _write(people[index]),
                            ),
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _FirstMessageDialog extends StatefulWidget {
  const _FirstMessageDialog({required this.person});

  final ChatPerson person;

  @override
  State<_FirstMessageDialog> createState() => _FirstMessageDialogState();
}

class _FirstMessageDialogState extends State<_FirstMessageDialog> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(text.chatFirstMessageTitle(widget.person.displayName)),
      content: TextField(
        controller: _controller,
        autofocus: true,
        minLines: 2,
        maxLines: 6,
        maxLength: 2000,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: text.chatComposerHint),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(text.actionCancel)),
        FilledButton(
          onPressed: () {
            final value = _controller.text.trim();
            if (value.isNotEmpty) Navigator.pop(context, value);
          },
          child: Text(text.chatSend),
        ),
      ],
    );
  }
}
