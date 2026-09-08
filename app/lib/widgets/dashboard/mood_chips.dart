import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/issue.dart';
import '../../providers/home_provider.dart';
import '../../providers/issues_provider.dart';
import '../../services/sloka_service.dart';
import '../common/eyebrow.dart';
import 'mood_sheet.dart';

/// Name what is weighing on you, and get a verse chosen for it.
///
/// The list is the seeded one, not free text — these are the categories verses
/// are actually mapped to, so anything outside them could not be answered.
///
/// The row renders nothing at all when the request fails or the list is empty.
/// It is one section of a dashboard that has plenty else on it, and an error
/// strip here would be louder than the feature is important.
class MoodChips extends ConsumerStatefulWidget {
  const MoodChips({super.key});

  @override
  ConsumerState<MoodChips> createState() => _MoodChipsState();
}

class _MoodChipsState extends ConsumerState<MoodChips> {
  /// The slug being asked about, so that chip alone shows the wait.
  String? _pending;

  Future<void> _choose(Issue issue) async {
    if (_pending != null) return;
    setState(() => _pending = issue.slug);

    // Captured before the await: the widget can be gone by the time this
    // resolves, and both of these are illegal to reach for after that.
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final text = AppLocalizations.of(context);

    try {
      final sloka = await SlokaService.instance.forMood(issue.slug);
      if (!mounted) return;

      // The personal sloka on the dashboard is the same row this just wrote,
      // so the card behind the sheet would otherwise still show the old verse.
      unawaited(ref.read(homeFeedProvider.notifier).refresh());

      await showMoodSloka(navigator.context, sloka: sloka, issueName: issue.name);
    } on ApiFailure catch (failure) {
      // 402 is the free quota running out, and 404 is a struggle nothing has
      // been mapped to yet. The backend writes both for a person to read, so
      // they are shown as they are rather than replaced with our own wording.
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            failure.statusCode == 402 || failure.statusCode == 404
                ? failure.message
                : text.errorGeneric,
          ),
        ),
      );
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(text.errorGeneric)));
    } finally {
      if (mounted) setState(() => _pending = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final issues = ref.watch(issuesProvider).value ?? const <Issue>[];
    if (issues.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow(text.homeMoodPrompt),
        const SizedBox(height: AppSpacing.md),
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            itemCount: issues.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
            itemBuilder: (context, index) => _MoodChip(
              issue: issues[index],
              busy: _pending == issues[index].slug,
              enabled: _pending == null,
              onTap: () => _choose(issues[index]),
            ),
          ),
        ),
      ],
    );
  }
}

class _MoodChip extends StatelessWidget {
  const _MoodChip({
    required this.issue,
    required this.busy,
    required this.enabled,
    required this.onTap,
  });

  final Issue issue;
  final bool busy;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      onPressed: enabled ? onTap : null,
      label: Text(issue.name),
      avatar: busy
          ? SizedBox(
              width: AppSizes.iconSm,
              height: AppSizes.iconSm,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: context.colors.primary,
              ),
            )
          : null,
    );
  }
}
