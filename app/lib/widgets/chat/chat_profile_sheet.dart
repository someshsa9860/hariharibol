import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/failure_text.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/sakha_profile.dart';
import '../../providers/sakha_profile_provider.dart';
import '../common/app_error_view.dart';
import '../common/app_loader.dart';
import 'chat_profile_details.dart';

/// What Sakha has noticed about the reader, and the two ways to keep it theirs:
/// switch the noticing off, or delete what is saved.
///
/// Shown on the root navigator like the app's other sheets. Opening it reads
/// the profile again, so it is always what the server holds now.
Future<void> showChatProfileSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    showDragHandle: true,
    builder: (_) => const _ChatProfileSheet(),
  );
}

class _ChatProfileSheet extends ConsumerStatefulWidget {
  const _ChatProfileSheet();

  @override
  ConsumerState<_ChatProfileSheet> createState() => _ChatProfileSheetState();
}

class _ChatProfileSheetState extends ConsumerState<_ChatProfileSheet> {
  /// A change is on its way to the server. The controls wait for it, so two
  /// switches or a switch and a delete never overlap.
  bool _busy = false;

  /// Why the last change did not go through. It is drawn in the sheet because a
  /// snack bar would sit underneath it.
  ApiFailure? _problem;

  Future<void> _run(Future<ApiFailure?> Function() change) async {
    setState(() {
      _busy = true;
      _problem = null;
    });
    final failure = await change();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _problem = failure;
    });
  }

  Future<void> _delete() async {
    final text = AppLocalizations.of(context);
    final sure = await AppNavigator.instance.confirm(
      title: text.chatProfileDelete,
      message: text.chatProfileDeleteBody,
      confirmLabel: text.actionDelete,
      isDestructive: true,
    );
    if (!sure || !mounted) return;
    await _run(ref.read(sakhaProfileProvider.notifier).delete);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final profile = ref.watch(sakhaProfileProvider);

    return SafeArea(
      child: SingleChildScrollView(
        padding: AppSpacing.card,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(text.chatProfileTitle, style: context.texts.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(
              text.chatProfileIntro,
              style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.lg),
            profile.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
                child: AppLoader(),
              ),
              error: (error, _) => AppErrorView(
                failure: error is ApiFailure ? error : const ApiFailure(kind: FailureKind.unknown),
                onRetry: () async => ref.invalidate(sakhaProfileProvider),
              ),
              data: _loaded,
            ),
          ],
        ),
      ),
    );
  }

  Widget _loaded(SakhaProfile profile) {
    final text = AppLocalizations.of(context);
    final problem = _problem;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: profile.learning,
          onChanged: _busy
              ? null
              : (learning) => _run(() => ref.read(sakhaProfileProvider.notifier).setLearning(learning)),
          title: Text(text.chatProfileLearning),
          subtitle: Text(text.chatProfileLearningHint),
        ),
        const SizedBox(height: AppSpacing.md),
        if (profile.isEmpty)
          Text(
            text.chatProfileEmpty,
            style: context.texts.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
          )
        else
          ChatProfileDetails(profile: profile),
        const SizedBox(height: AppSpacing.lg),
        _Note(text.chatProfileIssuesNote),
        if (problem != null) ...[
          const SizedBox(height: AppSpacing.md),
          _Problem(problem.describe(text)),
        ],
        // Nothing noted, nothing to delete: no button that has no work to do.
        if (!profile.isEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton.icon(
            onPressed: _busy ? null : _delete,
            icon: const Icon(Icons.delete_outline_rounded),
            label: Text(text.chatProfileDelete),
          ),
        ],
      ],
    );
  }
}

/// A line of small print with an icon in front of it.
class _Note extends StatelessWidget {
  const _Note(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.info_outline_rounded, size: AppSizes.iconSm, color: context.colors.onSurfaceVariant),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            message,
            style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
          ),
        ),
      ],
    );
  }
}

/// Why a change was refused — an icon and the words, announced when it appears.
class _Problem extends StatelessWidget {
  const _Problem(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline_rounded, size: AppSizes.iconMd, color: context.colors.error),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(message, style: context.texts.bodyMedium)),
        ],
      ),
    );
  }
}
