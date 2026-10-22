import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/developer_chat_config.dart';
import '../../core/format/chant_format.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/developer_chat.dart';
import '../../providers/developer_chat_provider.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/common/empty_state.dart';

/// The reader's chat with the developer. Replies arrive as they are written (the websocket is open while this
/// screen is), and a reply that comes while the app is closed is a push.
class DeveloperChatView extends ConsumerStatefulWidget {
  const DeveloperChatView({super.key});

  @override
  ConsumerState<DeveloperChatView> createState() => _DeveloperChatViewState();
}

class _DeveloperChatViewState extends ConsumerState<DeveloperChatView> with WidgetsBindingObserver {
  final ScrollController _scroll = ScrollController();
  final TextEditingController _controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _scroll.addListener(() {
      // The list is reversed, so its far end is the oldest message.
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) {
        ref.read(developerChatProvider.notifier).loadOlder().ignore();
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) ref.read(developerChatSocketProvider).resume();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _scroll.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _send() {
    final value = _controller.text.trim();
    if (value.isEmpty) return;
    _controller.clear();
    ref.read(developerChatProvider.notifier).send(value).ignore();
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final thread = ref.watch(developerChatProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.developerChatTitle, style: context.texts.headlineSmall)),
      body: Column(
        children: [
          Expanded(
            child: thread.when(
              loading: () => const AppLoader(),
              error: (error, _) => AppErrorView(
                failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
                onRetry: () async => ref.refresh(developerChatProvider.future),
              ),
              data: (state) => state.messages.isEmpty
                  ? Center(child: EmptyState(message: text.developerChatEmpty, icon: Icons.chat_bubble_outline_rounded))
                  : _Messages(state: state, controller: _scroll),
            ),
          ),
          SafeArea(
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
                      maxLength: DeveloperChatConfig.maxChars,
                      buildCounter: (context, {required currentLength, required isFocused, required maxLength}) => null,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(hintText: text.developerChatHint),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  IconButton.filled(
                    tooltip: text.developerChatSend,
                    onPressed: _send,
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Messages extends ConsumerWidget {
  const _Messages({required this.state, required this.controller});

  final DeveloperThread state;
  final ScrollController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messages = state.messages.reversed.toList();
    return ListView.builder(
      controller: controller,
      reverse: true,
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      itemCount: messages.length + (state.loadingOlder ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= messages.length) return const AppLoader();
        final message = messages[index];
        return _Bubble(
          message: message,
          onRetry: () => ref.read(developerChatProvider.notifier).retry(message.id),
        );
      },
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.onRetry});

  final DeveloperMessage message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final colors = context.colors;
    final mine = !message.fromDeveloper;
    final maxWidth = MediaQuery.sizeOf(context).width * 0.78;

    final bubble = Container(
      constraints: BoxConstraints(maxWidth: maxWidth),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: mine ? colors.primaryContainer : colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // A failed message is retried by tapping it, which selectable text would swallow.
          message.failed ? Text(message.body) : SelectableText(message.body),
          const SizedBox(height: AppSpacing.xs),
          Text(
            message.failed
                ? text.developerChatNotSent
                : (message.pending ? text.developerChatSending : formatDateTime(context, message.createdAt)),
            style: context.texts.labelSmall?.copyWith(color: message.failed ? colors.error : colors.onSurfaceVariant),
          ),
        ],
      ),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.xs),
      child: Align(
        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
        child: message.failed ? GestureDetector(onTap: onRetry, child: bubble) : bubble,
      ),
    );
  }
}
