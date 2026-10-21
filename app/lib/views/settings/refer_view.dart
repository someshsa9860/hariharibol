import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/referral.dart';
import '../../services/referral_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';

/// Read again whenever the screen opens: the server settles any referral that has become due as it answers.
final referralProvider = FutureProvider.autoDispose<ReferralSummary>((ref) => ReferralService.instance.summary());

/// Refer & Earn: the reader's link and code, how many invitations are settling in or rewarded, the months granted
/// (with their dates) and the history. Rules and the reward are decided on the server; this only shows them.
class ReferView extends ConsumerStatefulWidget {
  const ReferView({super.key});

  @override
  ConsumerState<ReferView> createState() => _ReferViewState();
}

class _ReferViewState extends ConsumerState<ReferView> {
  final TextEditingController _code = TextEditingController();
  bool _claiming = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _claim() async {
    final text = AppLocalizations.of(context);
    setState(() => _claiming = true);
    try {
      await ReferralService.instance.claim(_code.text);
      _code.clear();
      AppNavigator.instance.showMessage(text.referCodeThanks);
      ref.invalidate(referralProvider);
    } on ApiFailure {
      AppNavigator.instance.showMessage(text.referCodeRefused);
    } finally {
      if (mounted) setState(() => _claiming = false);
    }
  }

  String _range(ReferralReward r) {
    final f = DateFormat.yMMMd(Localizations.localeOf(context).toLanguageTag());
    return '${f.format(r.startsAt)} – ${f.format(r.endsAt)}';
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final summary = ref.watch(referralProvider);

    return Scaffold(
      appBar: AppBar(title: Text(text.referTitle, style: context.texts.headlineSmall)),
      body: summary.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
          onRetry: () async => ref.invalidate(referralProvider),
        ),
        data: (data) => ListView(
          padding: AppSpacing.page,
          children: [
            Text(text.referIntro, style: context.texts.bodyMedium),
            const SizedBox(height: AppSpacing.xl),
            Text(text.referYourLink, style: context.texts.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            SelectableText(data.url, style: context.texts.bodyMedium),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              children: [
                FilledButton.icon(
                  icon: const Icon(Icons.ios_share_rounded),
                  label: Text(text.referShare),
                  onPressed: () => SharePlus.instance.share(ShareParams(text: '${text.referShareLine}\n${data.url}')),
                ),
                OutlinedButton(
                  child: Text(text.shareCopyLink),
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: data.url));
                    AppNavigator.instance.showMessage(text.shareLinkCopied);
                  },
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            Row(
              children: [
                Expanded(child: _Stat(label: text.referPending, value: data.pending)),
                const SizedBox(width: AppSpacing.md),
                Expanded(child: _Stat(label: text.referRewarded, value: data.rewarded)),
              ],
            ),
            if (data.rewards.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xl),
              Text(text.referRewardsHeading, style: context.texts.titleMedium),
              for (final r in data.rewards) ListTile(contentPadding: EdgeInsets.zero, title: Text(_range(r))),
            ],
            if (data.history.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xl),
              Text(text.referHistoryHeading, style: context.texts.titleMedium),
              for (final h in data.history)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(h.name ?? '—'),
                  subtitle: Text(switch (h.status) {
                    'REWARDED' => text.referStatusRewarded,
                    'REJECTED' => text.referStatusRejected,
                    _ => text.referStatusPending,
                  }),
                ),
            ],
            if (!data.referredBy) ...[
              const SizedBox(height: AppSpacing.xl),
              Text(text.referHaveCode, style: context.texts.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _code,
                textCapitalization: TextCapitalization.characters,
                maxLength: 20,
                decoration: InputDecoration(labelText: text.referCodeHint),
                onChanged: (_) => setState(() {}),
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton(
                  onPressed: _claiming || _code.text.trim().length < 4 ? null : _claim,
                  child: Text(text.referUseCode),
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            Text(text.referTerms, style: context.texts.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: Column(
          children: [
            Text('$value', style: context.texts.headlineMedium),
            Text(label, style: context.texts.bodySmall, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
