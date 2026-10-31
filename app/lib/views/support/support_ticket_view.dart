import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/chant_format.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/constants/support_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/support.dart';
import '../../providers/support_live_provider.dart';
import '../../providers/support_provider.dart';
import '../../services/support_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_image.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/support/support_labels.dart';

/// One ticket: what the reader wrote, what we answered, and a box to reply.
/// Opening it marks our reply read.
class SupportTicketView extends ConsumerStatefulWidget {
  const SupportTicketView({super.key, required this.id});

  final String id;

  @override
  ConsumerState<SupportTicketView> createState() => _SupportTicketViewState();
}

class _SupportTicketViewState extends ConsumerState<SupportTicketView> {
  final TextEditingController _reply = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final body = _reply.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await SupportService.instance.reply(widget.id, body);
      _reply.clear();
      ref.invalidate(supportTicketProvider(widget.id));
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    // A staff reply to this ticket arrives over the line while it is open.
    ref.watch(supportLiveProvider);
    final ticket = ref.watch(supportTicketProvider(widget.id));

    return Scaffold(
      appBar: AppBar(title: Text(text.supportTicketTitle, style: context.texts.headlineSmall)),
      body: ticket.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
          onRetry: () async => ref.refresh(supportTicketProvider(widget.id).future),
        ),
        data: (data) => Column(
          children: [
            Expanded(
              child: ListView(
                padding: AppSpacing.page,
                children: [
                  Text(
                    '${supportCategoryLabel(text, data.category)} · ${supportStatusLabel(text, data.status)}',
                    style: context.texts.labelMedium,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (data.details case final details?) ...[
                    Text('${details.bookTitle} · ${details.languageName}', style: context.texts.titleSmall),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  if (data.screenshotUrl != null) ...[
                    // A signed link, re-signed on every fetch: kept on disk by
                    // its address without the query.
                    AppImage(url: data.screenshotUrl, cacheKey: data.screenshotUrl!.split('?').first, height: 180),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  for (final message in data.messages) _Bubble(message: message),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.sm, AppSpacing.sm),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _reply,
                        minLines: 1,
                        maxLines: 4,
                        maxLength: SupportConfig.ticketMaxChars,
                        decoration: InputDecoration(
                          hintText: text.supportReplyHint,
                          counterText: '',
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _sending ? null : _send,
                      icon: const Icon(Icons.send_rounded),
                      tooltip: text.supportSend,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final SupportMessage message;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final staff = message.fromStaff;
    final when = message.createdAt;

    return Align(
      alignment: staff ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        padding: AppSpacing.card,
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
        decoration: BoxDecoration(
          color: staff ? context.colors.surfaceContainerHigh : context.colors.primaryContainer,
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // The name, not just the side, says who wrote it.
            Text(staff ? text.supportFromSupport : text.supportYou, style: context.texts.labelSmall),
            const SizedBox(height: AppSpacing.xxs),
            Text(message.body, style: context.texts.bodyMedium),
            if (when != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(formatDateTime(context, when), style: context.texts.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}
