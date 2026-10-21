import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/share_links.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/share.dart';
import '../../providers/referral_provider.dart';
import '../../services/share_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';

/// Refer and earn: the person's code and link, what their invitations have
/// done, and the explicit-code fallback for an invitation whose link did not
/// survive the install (the app cannot know which link opened a store page).
class ReferView extends ConsumerStatefulWidget {
  const ReferView({super.key});

  @override
  ConsumerState<ReferView> createState() => _ReferViewState();
}

class _ReferViewState extends ConsumerState<ReferView> {
  final TextEditingController _typed = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _typed.dispose();
    super.dispose();
  }

  Future<void> _share(ReferralSummary summary) async {
    final text = AppLocalizations.of(context);
    await SharePlus.instance.share(ShareParams(text: text.referInviteMessage(summary.url)));
  }

  Future<void> _copy(String value) async {
    final text = AppLocalizations.of(context);
    await Clipboard.setData(ClipboardData(text: value));
    AppNavigator.instance.showMessage(text.shareCopied);
  }

  Future<void> _useCode() async {
    final text = AppLocalizations.of(context);
    final code = ShareLinks.normaliseInvite(_typed.text);
    if (code == null) {
      AppNavigator.instance.showMessage(text.referRefused);
      return;
    }
    setState(() => _busy = true);
    try {
      final result = await ShareService.instance.attribute(code, typed: true);
      AppNavigator.instance.showMessage(result.attributed ? text.referAccepted : text.referRefused);
      if (result.attributed) _typed.clear();
    } on ApiFailure catch (failure) {
      AppNavigator.instance.showFailure(failure);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final summary = ref.watch(referralProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.referTitle)),
      body: summary.when(
        loading: () => const Center(child: AppLoader()),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
          onRetry: () async => ref.invalidate(referralProvider),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async => ref.refresh(referralProvider.future),
          child: ListView(
            padding: AppSpacing.page,
            children: [
              Text(text.referIntro(data.rewardDays), style: context.texts.bodyLarge),
              const SizedBox(height: AppSpacing.lg),
              Text(text.referYourCode, style: context.texts.labelLarge),
              const SizedBox(height: AppSpacing.xs),
              Row(
                children: [
                  Semantics(
                    label: data.code.split('').join(' '),
                    child: Text(
                      data.code,
                      style: context.texts.headlineMedium?.copyWith(letterSpacing: 4, fontWeight: FontWeight.w700),
                    ),
                  ),
                  IconButton(onPressed: () => _copy(data.code), icon: const Icon(Icons.copy_rounded), tooltip: text.shareCopyLink),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                children: [
                  FilledButton.icon(onPressed: () => _share(data), icon: const Icon(Icons.ios_share_rounded), label: Text(text.referInvite)),
                  OutlinedButton(onPressed: () => _copy(data.url), child: Text(text.shareCopyLink)),
                ],
              ),
              if (data.rewardActiveUntil != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  text.referActiveUntil(DateFormat.yMMMd(Localizations.localeOf(context).toString()).format(data.rewardActiveUntil!.toLocal())),
                  style: context.texts.titleSmall,
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _Stat(value: data.invited, label: text.referStatInvited),
                  _Stat(value: data.pending, label: text.referStatWaiting),
                  _Stat(value: data.successful, label: text.referStatRewarded),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              if (data.history.isEmpty)
                Text(text.referNone, style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant))
              else
                for (final item in data.history)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(item.name),
                    subtitle: item.invitedAt == null ? null : Text(DateFormat.yMMMd().format(item.invitedAt!.toLocal())),
                    trailing: Text(_status(text, item.status)),
                  ),
              const SizedBox(height: AppSpacing.xl),
              Text(text.referEnterCode, style: context.texts.labelLarge),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _typed,
                      textCapitalization: TextCapitalization.characters,
                      maxLength: 14,
                      decoration: const InputDecoration(counterText: '', hintText: 'ABCD2345'),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton(onPressed: _busy ? null : _useCode, child: Text(text.referUseCode)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _status(AppLocalizations text, String status) => switch (status) {
        'QUALIFIED' => text.referStatRewarded,
        'PENDING' => text.referStatWaiting,
        _ => '—',
      };
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('$value', style: context.texts.headlineMedium),
        Text(label, style: context.texts.bodySmall),
      ],
    );
  }
}
